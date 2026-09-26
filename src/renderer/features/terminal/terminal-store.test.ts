import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
vi.mock('../../lib/log', () => ({ rlog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({
	toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

const { queryClient } = await import('../../lib/query-client');
const { runInTerminal, useTerminalStore } = await import('./terminal-store');

const run = (command: string): Promise<void> =>
	runInTerminal({ role: 'run', preset: 'powershell', title: 'run', command });

beforeEach(() => {
	call.mockReset().mockResolvedValue(true);
	useTerminalStore.setState({ tabs: [], active: null });
	queryClient.setQueryData(['workspace'], { root: 'C:/a' });
});

describe('runInTerminal', () => {
	it('reuses the role terminal of the same folder', async () => {
		await run('python a.py');
		await run('python a.py');
		expect(useTerminalStore.getState().tabs).toHaveLength(1);
		expect(call).toHaveBeenCalledWith(
			'terminal:write',
			expect.objectContaining({ data: 'python a.py\r' }),
		);
	});

	it("doesn't reuse another folder's role terminal (its cwd and venv are stale)", async () => {
		await run('python a.py');
		queryClient.setQueryData(['workspace'], { root: 'C:/b' });
		await run('python b.py');
		const tabs = useTerminalStore.getState().tabs;
		expect(tabs.map((t) => t.root)).toEqual(['C:/a', 'C:/b']);
		expect(tabs[1]?.initialCommand).toBe('python b.py');
		expect(call).not.toHaveBeenCalled();
	});
});
