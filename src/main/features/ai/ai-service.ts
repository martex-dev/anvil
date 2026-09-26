import type { AiContext, AiMessage, AiMode, AiModelRef, AiProvider } from '@shared/ipc/channels/ai';

import { AnvilError } from '../../core/errors';
import { buildCompletionRequest, type CompletionInput, parseCompletion } from './completion';
import { buildSystem } from './prompt';
import { buildRequest, parseEvent } from './providers';
import { SseParser } from './sse';

export interface StreamSink {
	delta(text: string): void;
	done(
		usage: { inputTokens: number | null; outputTokens: number | null },
		cancelled: boolean,
	): void;
	error(message: string): void;
}

const COMPLETION_TIMEOUT_MS = 8_000;
/** Silence that ends a streaming reply. Generous: reasoning models can think a while between chunks. */
const STREAM_IDLE_MS = 120_000;

/** Readable message from a provider's error body ({error: {message}} in every API here). */
export async function describeHttpError(provider: AiProvider, response: Response): Promise<string> {
	const text = await response.text().catch(() => '');
	let message = '';
	try {
		const json = JSON.parse(text) as { error?: { message?: string } | string };
		message = typeof json.error === 'string' ? json.error : (json.error?.message ?? '');
	} catch {
		message = text.slice(0, 300);
	}
	const hint =
		response.status === 401 || response.status === 403
			? ' Check the API key in Settings → Keys.'
			: response.status === 404
				? ' Check the model name.'
				: response.status === 429
					? ' Rate limited or out of credit.'
					: '';
	return `${provider} returned ${response.status}${message ? `: ${message}` : ''}.${hint}`;
}

export interface AiServiceOptions {
	getKey: (provider: AiProvider) => string | null;
	ollamaUrl: () => string;
	/** Tests only: send every provider's request to this origin instead. */
	baseOverride?: string | undefined;
}

export class AiService {
	private readonly running = new Map<string, AbortController>();

	constructor(private readonly options: AiServiceOptions) {}

	cancel(requestId: string): void {
		this.running.get(requestId)?.abort();
	}

	cancelAll(): void {
		for (const controller of this.running.values()) controller.abort();
	}

	private key(provider: AiProvider): string | null {
		// Ollama runs locally without auth.
		return provider === 'ollama' ? '' : this.options.getKey(provider);
	}

	private url(raw: string): string {
		if (!this.options.baseOverride) return raw;
		const u = new URL(raw);
		return this.options.baseOverride + u.pathname + u.search;
	}

	async stream(
		requestId: string,
		mode: AiMode,
		{ provider, model }: AiModelRef,
		messages: AiMessage[],
		context: AiContext[],
		sink: StreamSink,
	): Promise<void> {
		const key = this.key(provider);
		if (key === null) {
			sink.error(`No ${provider} API key. Add it in Settings → Keys.`);
			return;
		}
		const request = buildRequest(
			provider,
			model,
			key,
			buildSystem(context, mode),
			messages,
			this.options.ollamaUrl(),
		);
		const controller = new AbortController();
		this.running.set(requestId, controller);
		let inputTokens: number | null = null;
		let outputTokens: number | null = null;
		// A provider that stops sending without closing the connection would leave the reply
		// "streaming" forever: give up after a stretch of silence (reset by every chunk).
		let stalled = false;
		let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
		let idle: ReturnType<typeof setTimeout> | undefined;
		const touch = (): void => {
			clearTimeout(idle);
			idle = setTimeout(() => {
				stalled = true;
				controller.abort();
				// Releases a pending read even if the body isn't tied to the signal.
				void reader?.cancel().catch(() => undefined);
			}, STREAM_IDLE_MS);
		};
		const stallMessage = `No response from ${provider} for ${STREAM_IDLE_MS / 1000} s. Try again.`;
		try {
			touch();
			const response = await fetch(this.url(request.url), {
				method: 'POST',
				headers: request.headers,
				body: JSON.stringify(request.body),
				signal: controller.signal,
			});
			if (!response.ok || !response.body) {
				sink.error(await describeHttpError(provider, response));
				return;
			}
			const parser = new SseParser();
			const decoder = new TextDecoder();
			reader = response.body.getReader();
			for (;;) {
				touch();
				const { value, done } = await reader.read();
				if (done) break;
				for (const event of parser.push(decoder.decode(value, { stream: true }))) {
					const chunk = parseEvent(provider, event);
					if (chunk.error) {
						sink.error(`${provider}: ${chunk.error}`);
						await reader.cancel().catch(() => undefined);
						return;
					}
					if (chunk.text) sink.delta(chunk.text);
					if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
					if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
				}
			}
			if (stalled) sink.error(stallMessage);
			else sink.done({ inputTokens, outputTokens }, false);
		} catch (error) {
			if (stalled) sink.error(stallMessage);
			else if (controller.signal.aborted) sink.done({ inputTokens, outputTokens }, true);
			else sink.error(unreachable(provider, error));
		} finally {
			clearTimeout(idle);
			this.running.delete(requestId);
		}
	}

	/**
	 * Ghost text. Resolves '' when cancelled (the user kept typing). A missing key or a timeout
	 * throws, so the status bar can show why suggestions never appear.
	 */
	async complete(
		requestId: string,
		{ provider, model }: AiModelRef,
		input: CompletionInput,
	): Promise<string> {
		const key = this.key(provider);
		if (key === null) {
			throw new AnvilError(
				'AI_NO_KEY',
				`No ${provider} API key for autocomplete. Add it in Settings → Keys.`,
			);
		}
		const request = buildCompletionRequest(
			provider,
			model,
			key,
			input,
			this.options.ollamaUrl(),
		);
		const controller = new AbortController();
		this.running.set(requestId, controller);
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, COMPLETION_TIMEOUT_MS);
		try {
			const response = await fetch(this.url(request.url), {
				method: 'POST',
				headers: request.headers,
				body: JSON.stringify(request.body),
				signal: controller.signal,
			});
			if (!response.ok) throw new Error(await describeHttpError(provider, response));
			return parseCompletion(provider, await response.json());
		} catch (error) {
			if (timedOut) {
				throw new AnvilError(
					'AI_COMPLETE_TIMEOUT',
					`${provider} autocomplete did not answer within ${COMPLETION_TIMEOUT_MS / 1000} s.`,
					error,
				);
			}
			if (controller.signal.aborted) return '';
			throw new Error(unreachable(provider, error), { cause: error });
		} finally {
			clearTimeout(timer);
			this.running.delete(requestId);
		}
	}
}

function unreachable(provider: AiProvider, error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (message.includes(`${provider} returned`)) return message;
	return provider === 'ollama'
		? `Could not reach Ollama: ${message}. Is \`ollama serve\` running?`
		: `Could not reach ${provider}: ${message}`;
}
