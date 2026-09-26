import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiService } from './ai-service';

const input = { path: 'a.py', language: 'python', prefix: 'x = ', suffix: '' };

/** A fetch that never answers until its signal aborts, like a stalled provider. */
function hangingFetch(): typeof fetch {
	return ((_url: string, init?: RequestInit) =>
		new Promise((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
		})) as typeof fetch;
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('AiService.complete', () => {
	it('explains a missing key instead of resolving empty', async () => {
		const ai = new AiService({ getKey: () => null, ollamaUrl: () => '' });
		await expect(
			ai.complete('r1', { provider: 'openai', model: 'gpt-5-mini' }, input),
		).rejects.toMatchObject({ code: 'AI_NO_KEY', message: expect.stringMatching(/openai/) });
	});

	it('reports a timeout, but stays silent when the user cancels', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', hangingFetch());
		const ai = new AiService({ getKey: () => 'k', ollamaUrl: () => '' });
		const model = { provider: 'anthropic' as const, model: 'claude-haiku-4-5' };

		const timedOut = ai.complete('r1', model, input);
		const assertion = expect(timedOut).rejects.toMatchObject({ code: 'AI_COMPLETE_TIMEOUT' });
		await vi.advanceTimersByTimeAsync(8_000);
		await assertion;

		const cancelled = ai.complete('r2', model, input);
		ai.cancel('r2');
		await expect(cancelled).resolves.toBe('');
	});
});

describe('AiService.stream', () => {
	it('gives up when the provider goes silent mid-reply', async () => {
		vi.useFakeTimers();
		const first = 'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n';
		vi.stubGlobal(
			'fetch',
			(async () =>
				new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							// Sends one chunk, then never another and never closes.
							controller.enqueue(new TextEncoder().encode(first));
						},
					}),
				)) as typeof fetch,
		);
		const ai = new AiService({ getKey: () => 'k', ollamaUrl: () => '' });
		const sink = { delta: vi.fn(), done: vi.fn(), error: vi.fn() };

		const run = ai.stream('r1', 'chat', { provider: 'openai', model: 'gpt-5' }, [], [], sink);
		await vi.advanceTimersByTimeAsync(120_000);
		await run;

		expect(sink.delta).toHaveBeenCalledWith('Hel');
		expect(sink.done).not.toHaveBeenCalled();
		expect(sink.error).toHaveBeenCalledWith(expect.stringMatching(/No response from openai/));
	});
});
