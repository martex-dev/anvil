import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn<(channel: string, input: unknown) => Promise<unknown>>();
const streamOnce =
	vi.fn<
		(o: {
			signal?: AbortSignal;
			onPartial?: (t: string) => void;
			context: unknown;
		}) => Promise<string>
	>();

vi.mock('../../lib/ipc', () => ({ call: (c: string, i: unknown) => call(c, i) }));
vi.mock('./requests', () => ({
	streamOnce: (o: Parameters<typeof streamOnce>[0]) => streamOnce(o),
}));

const { cancelCommitMessage, generateCommitMessage } = await import('./commit-message');

beforeEach(() => {
	call.mockReset();
	call.mockResolvedValue({ diff: '+x = 1\n', truncated: false });
	streamOnce.mockReset();
});

describe('generateCommitMessage', () => {
	it('stops on cancel and keeps what was written so far', async () => {
		streamOnce.mockImplementation(
			(o) =>
				new Promise((_, reject) => {
					o.onPartial?.('feat(core): add ');
					o.signal?.addEventListener('abort', () => reject(new Error('Cancelled')));
				}),
		);
		const partials: string[] = [];
		const message = generateCommitMessage((t) => partials.push(t));
		await vi.waitFor(() => expect(streamOnce).toHaveBeenCalled());

		expect(cancelCommitMessage()).toBe(true);

		await expect(message).resolves.toBe('feat(core): add');
		expect(partials).toEqual(['feat(core): add']);
		expect(cancelCommitMessage()).toBe(false);
	});

	it('sends nothing when stopped while git reads the diff', async () => {
		const abort = new AbortController();
		const message = generateCommitMessage(() => undefined, abort.signal);
		abort.abort();
		await expect(message).resolves.toBe('');
		expect(streamOnce).not.toHaveBeenCalled();
	});

	it('still fails on real errors', async () => {
		call.mockResolvedValue({ diff: '  ', truncated: false });
		await expect(generateCommitMessage(() => undefined)).rejects.toThrow('Nothing is staged');
	});
});
