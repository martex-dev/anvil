import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
const quickPick = vi.fn();
const toastInfo = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
vi.mock('../../lib/log', () => ({ rlog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({
	toast: { error: vi.fn(), info: toastInfo, success: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../ui/QuickPick', () => ({ quickPick }));

const { useLayoutStore } = await import('../../stores/layout-store');
const { useTerminalStore } = await import('./terminal-store');
const { clearTerminal, cycleTerminal, findInTerminal, killActiveTerminal } =
	await import('./commands');
const { closeTerminalFind, registerTerminal, useTerminalFind } =
	await import('./terminal-registry');
const { uniqueTitle } = await import('./terminal-store');

const tab = { id: 'anvil-1111-2222', preset: 'powershell' as const, title: 'pwsh 1' };

beforeEach(() => {
	call.mockReset().mockResolvedValue(undefined);
	quickPick.mockReset();
	toastInfo.mockReset();
	useTerminalStore.setState({ tabs: [tab], active: tab.id });
	useLayoutStore.setState({ panelOpen: true, panelTab: 'terminal' });
});

describe('killActiveTerminal', () => {
	it('says so when there is no terminal', async () => {
		useTerminalStore.setState({ tabs: [], active: null });
		await killActiveTerminal();
		expect(toastInfo).toHaveBeenCalledWith('No terminal to kill');
		expect(call).not.toHaveBeenCalled();
	});

	it('kills a visible terminal and reports it', async () => {
		await killActiveTerminal();
		expect(quickPick).not.toHaveBeenCalled();
		expect(call).toHaveBeenCalledWith('terminal:kill', tab.id);
		expect(toastInfo).toHaveBeenCalledWith('Killed pwsh 1');
		expect(useTerminalStore.getState().tabs).toEqual([]);
	});

	it('asks before killing a hidden terminal', async () => {
		useLayoutStore.setState({ panelTab: 'problems' });
		quickPick.mockResolvedValue('cancel');
		await killActiveTerminal();
		expect(quickPick).toHaveBeenCalled();
		expect(call).not.toHaveBeenCalled();
		expect(useTerminalStore.getState().tabs).toHaveLength(1);
	});
});

describe('terminal names and switching', () => {
	it('numbers new terminals with the lowest free number', () => {
		expect(uniqueTitle(['pwsh 2'], 'pwsh', true)).toBe('pwsh 1');
		expect(uniqueTitle(['pwsh 1', 'pwsh 2'], 'pwsh', true)).toBe('pwsh 3');
		expect(uniqueTitle([], 'claude', false)).toBe('claude');
		expect(uniqueTitle(['claude'], 'claude', false)).toBe('claude 2');
	});

	it('cycles through terminals, wrapping around', () => {
		vi.stubGlobal('requestAnimationFrame', () => 0);
		const other = { ...tab, id: 'anvil-3333-4444', title: 'pwsh 2' };
		useTerminalStore.setState({ tabs: [tab, other], active: other.id });
		cycleTerminal(1);
		expect(useTerminalStore.getState().active).toBe(tab.id);
		cycleTerminal(-1);
		expect(useTerminalStore.getState().active).toBe(other.id);
		vi.unstubAllGlobals();
	});
});

describe('find and clear', () => {
	const api = { clear: vi.fn(), find: vi.fn(), clearFind: vi.fn(), focus: vi.fn() };

	it('say so when the active terminal has no live xterm', () => {
		clearTerminal();
		findInTerminal();
		expect(toastInfo).toHaveBeenCalledTimes(2);
		expect(useTerminalFind.getState().open).toBeNull();
	});

	it('clear the active terminal and open its find bar, which closes back to it', () => {
		const unregister = registerTerminal(tab.id, api);
		useLayoutStore.setState({ panelOpen: false });
		clearTerminal();
		expect(api.clear).toHaveBeenCalled();
		findInTerminal();
		expect(useTerminalFind.getState().open).toBe(tab.id);
		expect(useLayoutStore.getState().panelOpen).toBe(true);
		closeTerminalFind();
		expect(useTerminalFind.getState().open).toBeNull();
		expect(api.clearFind).toHaveBeenCalled();
		expect(api.focus).toHaveBeenCalled();
		unregister();
	});
});
