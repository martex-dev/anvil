import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn<(channel: string, input: unknown) => Promise<void>>();
let settingsLoaded: () => void = () => undefined;

vi.mock('../../lib/ipc', () => ({ call: (c: string, i: unknown) => call(c, i) }));
vi.mock('./ai-settings', () => ({
	getAiSettings: () =>
		new Promise((resolve) => {
			settingsLoaded = () => resolve({ chat: { provider: 'anthropic', model: 'm' } });
		}),
}));

const { routeDone, streamOnce } = await import('./requests');

const request = (signal: AbortSignal): Promise<string> =>
	streamOnce({ mode: 'edit', messages: [], context: [], signal });

beforeEach(() => {
	call.mockReset();
	call.mockResolvedValue(undefined);
});

describe('streamOnce', () => {
	it('never sends a request cancelled while the settings load', async () => {
		const abort = new AbortController();
		const reply = request(abort.signal);
		abort.abort();
		settingsLoaded();

		await expect(reply).rejects.toThrow('Cancelled');
		expect(call).not.toHaveBeenCalled();
	});

	it('stops listening for aborts once the reply is done', async () => {
		const abort = new AbortController();
		const reply = request(abort.signal);
		settingsLoaded();
		await vi.waitFor(() => expect(call).toHaveBeenCalledWith('ai:send', expect.anything()));
		const [, sent] = call.mock.calls[0] ?? [];
		routeDone((sent as { requestId: string }).requestId, false);
		await expect(reply).resolves.toBe('');

		abort.abort();

		expect(call).toHaveBeenCalledTimes(1);
	});
});
