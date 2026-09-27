import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
vi.mock('../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../stores/toast-store', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
vi.mock('../features/terminal/terminal-persist', () => ({
	loadTerminals: () => ({ tabs: [], active: null }),
	saveTerminals: vi.fn(),
}));

import { useTerminalStore } from '../features/terminal/terminal-store';
import { renameTerminal, restartTerminal } from './terminal-tabs';

beforeEach(() => {
	call.mockClear();
	useTerminalStore.setState({
		tabs: [
			{ id: 'a', preset: 'powershell', title: 'pwsh 1' },
			{ id: 'b', preset: 'repl', title: 'repl', role: 'repl', root: 'C:/proj' },
			{ id: 'c', preset: 'cmd', title: 'cmd 1' },
		],
		active: 'b',
	});
});

describe('restartTerminal', () => {
	it('replaces the session in place, keeping name, role, folder and focus', () => {
		restartTerminal('b', 'fresh');
		const { tabs, active } = useTerminalStore.getState();
		expect(tabs.map((t) => t.id)).toEqual(['a', 'fresh', 'c']);
		expect(tabs[1]).toEqual({
			id: 'fresh',
			preset: 'repl',
			title: 'repl',
			role: 'repl',
			root: 'C:/proj',
		});
		expect(active).toBe('fresh');
		expect(call).toHaveBeenCalledWith('terminal:kill', 'b');
	});

	it('leaves the active tab alone when restarting another one', () => {
		restartTerminal('a', 'fresh');
		expect(useTerminalStore.getState().active).toBe('b');
	});
});

describe('renameTerminal', () => {
	it('trims the name and ignores an empty one', () => {
		renameTerminal('a', '  server  ');
		expect(useTerminalStore.getState().tabs[0]?.title).toBe('server');
		renameTerminal('a', '   ');
		expect(useTerminalStore.getState().tabs[0]?.title).toBe('server');
	});
});
