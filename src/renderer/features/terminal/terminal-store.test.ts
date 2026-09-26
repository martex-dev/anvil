import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
vi.mock('../../lib/log', () => ({ rlog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({
	toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

const { queryClient } = await import('../../lib/query-client');
const { closeTerminal, markAttached, runInTerminal, unmarkAttached, useTerminalStore } =
	await import('./terminal-store');
const { useLayoutStore } = await import('../../stores/layout-store');

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
		const id = useTerminalStore.getState().tabs[0]?.id ?? '';
		markAttached(id);
		await run('python a.py');
		unmarkAttached(id);
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

	it("hands a restored tab's command to its pane instead of racing its open", async () => {
		useTerminalStore.setState({
			tabs: [
				{
					id: 'anvil-restored',
					preset: 'powershell',
					title: 'run',
					role: 'run',
					root: 'C:/a',
				},
			],
			active: null,
		});
		await run('python a.py');
		const tab = useTerminalStore.getState().tabs[0];
		expect(tab?.initialCommand).toBe('python a.py');
		expect(useTerminalStore.getState().active).toBe('anvil-restored');
		expect(call).not.toHaveBeenCalled();
	});
});

describe('closeTerminal', () => {
	it('hands keyboard focus to the tab that replaces the active one', () => {
		const frames: Array<() => void> = [];
		const focused: unknown[] = [];
		vi.stubGlobal('requestAnimationFrame', (f: () => void) => frames.push(f));
		vi.stubGlobal('window', { dispatchEvent: (e: CustomEvent) => focused.push(e.detail) });
		useLayoutStore.setState({ panelOpen: true, panelTab: 'terminal' });
		const a = { id: 'anvil-aaaa-1111', preset: 'powershell' as const, title: 'pwsh 1' };
		const b = { id: 'anvil-bbbb-2222', preset: 'powershell' as const, title: 'pwsh 2' };
		useTerminalStore.setState({ tabs: [a, b], active: a.id });
		closeTerminal(a.id);
		for (const f of frames) f();
		expect(focused).toEqual([b.id]);
		vi.unstubAllGlobals();
	});
});
