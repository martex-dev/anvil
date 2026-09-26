import type { AiContext, AiMessage, AiMode } from '@shared/ipc/channels/ai';

import { call } from '../../lib/ipc';
import { getAiSettings } from './ai-settings';

interface Pending {
	text: string;
	onPartial?: ((text: string) => void) | undefined;
	resolve: (text: string) => void;
	reject: (error: Error) => void;
}

/** One-shot streamed requests (inline edit, commit message); chat has its own store. */
const pending = new Map<string, Pending>();

export function isOneShot(requestId: string): boolean {
	return pending.has(requestId);
}

export function routeDelta(requestId: string, text: string): void {
	const p = pending.get(requestId);
	if (!p) return;
	p.text += text;
	p.onPartial?.(p.text);
}

export function routeDone(requestId: string, cancelled: boolean, truncated = false): void {
	const p = pending.get(requestId);
	if (!p) return;
	pending.delete(requestId);
	if (cancelled) p.reject(new Error('Cancelled'));
	// A half-written edit or commit message is worse than none: never hand it on as complete.
	else if (truncated) p.reject(new Error('The reply was cut off at the model’s token limit.'));
	else p.resolve(p.text);
}

export function routeError(requestId: string, message: string): void {
	const p = pending.get(requestId);
	if (!p) return;
	pending.delete(requestId);
	p.reject(new Error(message));
}

/**
 * Streams one reply on the chat model and resolves with the full text. `onPartial` sees the
 * text so far (for live previews); `signal` cancels.
 */
export async function streamOnce(options: {
	mode: AiMode;
	messages: AiMessage[];
	context: AiContext[];
	onPartial?: (text: string) => void;
	signal?: AbortSignal;
}): Promise<string> {
	const { signal } = options;
	const settings = await getAiSettings();
	// Cancelled while the settings loaded: never send it, or the provider runs (and bills) it.
	if (signal?.aborted) throw new Error('Cancelled');
	const requestId = crypto.randomUUID();
	const done = new Promise<string>((resolve, reject) => {
		pending.set(requestId, { text: '', onPartial: options.onPartial, resolve, reject });
	});
	const onAbort = (): void => void call('ai:cancel', requestId).catch(() => undefined);
	signal?.addEventListener('abort', onAbort, { once: true });
	try {
		await call('ai:send', {
			requestId,
			mode: options.mode,
			model: settings.chat,
			messages: options.messages,
			context: options.context,
		});
	} catch (error) {
		routeError(requestId, error instanceof Error ? error.message : String(error));
	}
	try {
		return await done;
	} finally {
		signal?.removeEventListener('abort', onAbort);
	}
}
