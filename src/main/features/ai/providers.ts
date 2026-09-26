import type { AiMessage, AiProvider } from '@shared/ipc/channels/ai';

import type { SseEvent } from './sse';

/** Streaming requests can afford a high ceiling; hitting it cuts a reply off mid-thought. */
const MAX_TOKENS: Record<AiProvider, number> = {
	anthropic: 64_000,
	openai: 32_000,
	gemini: 32_000,
	ollama: 8_192,
};

export interface ProviderRequest {
	url: string;
	headers: Record<string, string>;
	body: unknown;
}

export interface StreamChunk {
	text?: string;
	done?: boolean;
	error?: string;
	inputTokens?: number;
	outputTokens?: number;
	/** The reply hit the output-token limit and was cut off. */
	truncated?: boolean;
	/** The provider withheld the reply (safety filter, prompt blocked); a readable reason. */
	blocked?: string;
}

/** SAFETY / PROHIBITED_CONTENT → "safety" / "prohibited content". */
const readable = (reason: unknown): string => String(reason).toLowerCase().replace(/_/g, ' ');

export const PROVIDER_SECRET: Record<Exclude<AiProvider, 'ollama'>, string> = {
	anthropic: 'anthropic.key',
	openai: 'openai.key',
	gemini: 'gemini.key',
};

/**
 * Models that support Anthropic's server-side refusal fallback: if a safety classifier declines
 * a request, the API re-runs it on a fallback model inside the same call.
 */
export function supportsFallback(model: string): boolean {
	return /^claude-(?:opus-5|fable-5)/.test(model);
}

/** The HTTP request that starts a streaming reply. `key` is ignored for Ollama. */
export function buildRequest(
	provider: AiProvider,
	model: string,
	key: string,
	system: string,
	messages: AiMessage[],
	ollamaUrl = 'http://127.0.0.1:11434',
): ProviderRequest {
	switch (provider) {
		case 'anthropic': {
			const fallback = supportsFallback(model);
			return {
				url: 'https://api.anthropic.com/v1/messages',
				headers: {
					'x-api-key': key,
					'anthropic-version': '2023-06-01',
					'content-type': 'application/json',
					...(fallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
				},
				body: {
					model,
					max_tokens: MAX_TOKENS.anthropic,
					system,
					messages,
					stream: true,
					// Caches the growing conversation, so each follow-up only pays for the new turn.
					cache_control: { type: 'ephemeral' },
					...(fallback ? { fallbacks: 'default' } : {}),
				},
			};
		}
		case 'openai':
		case 'ollama':
			return {
				url:
					provider === 'openai'
						? 'https://api.openai.com/v1/chat/completions'
						: `${ollamaUrl.replace(/\/+$/, '')}/v1/chat/completions`,
				headers: {
					...(provider === 'openai' ? { authorization: `Bearer ${key}` } : {}),
					'content-type': 'application/json',
				},
				body: {
					model,
					stream: true,
					max_completion_tokens: MAX_TOKENS[provider],
					stream_options: { include_usage: true },
					messages: [{ role: 'system', content: system }, ...messages],
				},
			};
		case 'gemini':
			return {
				url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
				headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
				body: {
					systemInstruction: { parts: [{ text: system }] },
					contents: messages.map((m) => ({
						role: m.role === 'assistant' ? 'model' : 'user',
						parts: [{ text: m.content }],
					})),
					generationConfig: { maxOutputTokens: MAX_TOKENS.gemini },
				},
			};
	}
}

type Obj = Record<string, unknown>;
export const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const parse = (data: string): Obj | null => {
	try {
		return obj(JSON.parse(data));
	} catch {
		return null;
	}
};

/** Gemini finish reasons that are not a block (MAX_TOKENS is reported as truncation). */
const GEMINI_OK_FINISH = new Set(['STOP', 'MAX_TOKENS', 'FINISH_REASON_UNSPECIFIED']);

/** One SSE event → what it means for the conversation. */
export function parseEvent(provider: AiProvider, event: SseEvent): StreamChunk {
	if ((provider === 'openai' || provider === 'ollama') && event.data === '[DONE]')
		return { done: true };
	const json = parse(event.data);
	if (!json) return {};
	if (json['error']) {
		const error = obj(json['error']);
		return { error: String(error['message'] ?? JSON.stringify(json['error'])) };
	}
	switch (provider) {
		case 'anthropic': {
			const type = String(json['type'] ?? event.event ?? '');
			if (type === 'content_block_delta') {
				const delta = obj(json['delta']);
				return delta['type'] === 'text_delta' ? { text: String(delta['text'] ?? '') } : {};
			}
			if (type === 'message_start') {
				const usage = obj(obj(json['message'])['usage']);
				const cached =
					Number(usage['cache_read_input_tokens'] ?? 0) +
					Number(usage['cache_creation_input_tokens'] ?? 0);
				return { inputTokens: Number(usage['input_tokens'] ?? 0) + cached };
			}
			if (type === 'message_delta') {
				const stop = obj(json['delta'])['stop_reason'];
				if (stop === 'refusal') {
					return {
						error: 'Claude declined this request. Rephrase it or try another model.',
					};
				}
				return {
					outputTokens: Number(obj(json['usage'])['output_tokens'] ?? 0),
					...(stop === 'max_tokens' ? { truncated: true } : {}),
				};
			}
			if (type === 'message_stop') return { done: true };
			return {};
		}
		case 'openai':
		case 'ollama': {
			const choice = obj((json['choices'] as unknown[] | undefined)?.[0]);
			const usage = obj(json['usage']);
			const content = obj(choice['delta'])['content'];
			const finish = choice['finish_reason'];
			return {
				...(typeof content === 'string' && content ? { text: content } : {}),
				...(finish === 'length' ? { truncated: true } : {}),
				...(finish === 'content_filter' ? { blocked: 'content filter' } : {}),
				...(usage['prompt_tokens'] !== undefined
					? {
							inputTokens: Number(usage['prompt_tokens']),
							outputTokens: Number(usage['completion_tokens'] ?? 0),
						}
					: {}),
			};
		}
		case 'gemini': {
			const candidate = obj((json['candidates'] as unknown[] | undefined)?.[0]);
			const parts = (obj(candidate['content'])['parts'] as unknown[] | undefined) ?? [];
			const text = parts.map((p) => String(obj(p)['text'] ?? '')).join('');
			const usage = obj(json['usageMetadata']);
			const finish = candidate['finishReason'];
			const promptBlock = obj(json['promptFeedback'])['blockReason'];
			const blocked =
				promptBlock !== undefined
					? `prompt: ${readable(promptBlock)}`
					: typeof finish === 'string' && !GEMINI_OK_FINISH.has(finish)
						? readable(finish)
						: undefined;
			return {
				...(text ? { text } : {}),
				...(finish === 'MAX_TOKENS' ? { truncated: true } : {}),
				...(blocked ? { blocked } : {}),
				...(usage['promptTokenCount'] !== undefined
					? {
							inputTokens: Number(usage['promptTokenCount']),
							outputTokens: Number(usage['candidatesTokenCount'] ?? 0),
						}
					: {}),
			};
		}
	}
}
