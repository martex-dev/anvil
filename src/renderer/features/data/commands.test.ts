import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTabsStore } from '../../stores/tabs-store';
import { useToastStore } from '../../stores/toast-store';
import { DATA_COMMANDS } from './commands';
import { type DataViewerActions, registerDataViewer } from './data-actions';

function fakeViewer(): DataViewerActions {
	return {
		focusFilter: vi.fn(),
		clearFilter: vi.fn(),
		copyCsv: vi.fn(),
		reload: vi.fn(),
		toggleProfile: vi.fn(),
		openAsText: vi.fn(),
		clearSort: vi.fn(),
	};
}

function run(id: string): void {
	const command = DATA_COMMANDS.find((c) => c.id === id);
	if (!command) throw new Error(`missing ${id}`);
	void command.run();
}

afterEach(() => useTabsStore.getState().reset());

describe('data commands', () => {
	it('act on the table in the focused tab', () => {
		const viewer = fakeViewer();
		const unregister = registerDataViewer('prices.csv', viewer);
		useTabsStore
			.getState()
			.open({ id: 'data:prices.csv', kind: 'data', path: 'prices.csv', title: 'prices.csv' });
		run('data.reload');
		run('data.focusFilter');
		expect(viewer.reload).toHaveBeenCalledOnce();
		expect(viewer.focusFilter).toHaveBeenCalledOnce();
		unregister();
	});

	it('explain themselves when no table is focused', () => {
		const viewer = fakeViewer();
		const unregister = registerDataViewer('prices.csv', viewer);
		useTabsStore
			.getState()
			.open({ id: 'code:bot.py', kind: 'code', path: 'bot.py', title: 'bot.py' });
		run('data.copyCsv');
		expect(viewer.copyCsv).not.toHaveBeenCalled();
		expect(useToastStore.getState().toasts.at(-1)?.title).toMatch(/data file/);
		unregister();
	});

	it('forget a viewer once it unregisters', () => {
		const first = fakeViewer();
		const second = fakeViewer();
		const unregisterFirst = registerDataViewer('a.csv', first);
		const unregisterSecond = registerDataViewer('a.csv', second);
		// A stale cleanup from the first instance must not drop the newer registration.
		unregisterFirst();
		useTabsStore.getState().open({ id: 'data:a.csv', kind: 'data', path: 'a.csv', title: 'a' });
		run('data.clearSort');
		expect(second.clearSort).toHaveBeenCalledOnce();
		unregisterSecond();
	});
});
