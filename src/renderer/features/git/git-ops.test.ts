import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
// Dispatches a window event; there is no window under the node test environment.
vi.mock('../editor/extras/git-lines', () => ({ invalidateGitLines: vi.fn() }));

const { runRemote, useGitRemote } = await import('./git-ops');
const { useToastStore } = await import('../../stores/toast-store');

const titles = (): string[] => useToastStore.getState().toasts.map((t) => t.title);

beforeEach(() => {
	call.mockReset();
	useGitRemote.setState({ running: null });
	useToastStore.setState({ toasts: [] });
});

describe('runRemote', () => {
	it('shows progress while running and replaces it with the outcome', async () => {
		let finish: (value: { summary: string }) => void = () => undefined;
		call.mockReturnValue(new Promise((resolve) => (finish = resolve)));
		const pending = runRemote('pull', { announce: true });
		expect(useGitRemote.getState().running).toBe('pull');
		expect(titles()).toEqual(['Pulling…']);
		finish({ summary: '3 files changed' });
		expect(await pending).toBe(true);
		expect(titles()).toEqual(['Pulled']);
		expect(useGitRemote.getState().running).toBeNull();
	});

	it('refuses a second operation while one is running', async () => {
		let finish: (value: { summary: string }) => void = () => undefined;
		call.mockReturnValue(new Promise((resolve) => (finish = resolve)));
		const first = runRemote('pull', { announce: false });
		expect(await runRemote('push', { announce: false })).toBe(false);
		expect(call).toHaveBeenCalledTimes(1);
		expect(titles()).toEqual(['Git is busy']);
		finish({ summary: '' });
		await first;
	});

	it('reports a failure and frees the lock', async () => {
		call.mockRejectedValue(new Error('rejected: non-fast-forward'));
		expect(await runRemote('push', { announce: true })).toBe(false);
		expect(titles()).toEqual(['Push failed']);
		expect(useGitRemote.getState().running).toBeNull();
	});
});
