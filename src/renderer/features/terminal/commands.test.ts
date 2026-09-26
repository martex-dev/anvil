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
const { killActiveTerminal } = await import('./commands');

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
