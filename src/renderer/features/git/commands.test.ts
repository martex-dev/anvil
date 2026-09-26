import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
// Dispatches a window event; there is no window under the node test environment.
vi.mock('../editor/extras/git-lines', () => ({ invalidateGitLines: vi.fn() }));
const quickPick = vi.fn();
vi.mock('../../ui/QuickPick', () => ({ quickPick: (...args: unknown[]) => quickPick(...args) }));

const { GIT_COMMANDS } = await import('./commands');
const { useToastStore } = await import('../../stores/toast-store');

function run(id: string): Promise<void> {
	const command = GIT_COMMANDS.find((c) => c.id === id);
	if (!command) throw new Error(`no command ${id}`);
	return Promise.resolve(command.run());
}

describe('git.sync', () => {
	beforeEach(() => {
		call.mockReset();
		useToastStore.setState({ toasts: [] });
	});

	it('pushes after a successful pull', async () => {
		call.mockResolvedValue({ summary: 'ok' });
		await run('git.sync');
		expect(call.mock.calls.map((c) => c[0])).toEqual(['git:pull', 'git:push']);
	});

	it('does not push when the pull failed', async () => {
		call.mockRejectedValueOnce(new Error('merge conflict'));
		await run('git.sync');
		expect(call.mock.calls.map((c) => c[0])).toEqual(['git:pull']);
		expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual(['Pulled failed']);
	});
});

describe('git.log', () => {
	const writeText = vi.fn();
	beforeEach(() => {
		call.mockReset().mockResolvedValue([]);
		writeText.mockReset().mockResolvedValue(undefined);
		quickPick.mockReset();
		useToastStore.setState({ toasts: [] });
		vi.stubGlobal('navigator', { clipboard: { writeText } });
	});

	it('copies the picked commit hash', async () => {
		quickPick.mockResolvedValue('0123456789abcdef');
		await run('git.log');
		expect(writeText).toHaveBeenCalledWith('0123456789abcdef');
		expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual(['Commit hash copied']);
	});

	it('does nothing when the picker is dismissed', async () => {
		quickPick.mockResolvedValue(null);
		await run('git.log');
		expect(writeText).not.toHaveBeenCalled();
		expect(useToastStore.getState().toasts).toEqual([]);
	});
});
