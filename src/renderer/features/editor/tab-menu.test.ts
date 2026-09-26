import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '../../stores/layout-store';
import type { Tab } from '../../stores/tabs-store';
import { useWorkbenchStore } from '../../stores/workbench-store';
import type { MenuItem } from '../../ui/ContextMenu';

vi.mock('./open', () => ({ closeTab: vi.fn(), closeOtherTabs: vi.fn() }));
vi.mock('./file-ops', () => ({
	isScratch: (path: string | null | undefined) => path === '__scratch__',
}));

const { tabMenuItems } = await import('./tab-menu');

const code = (path: string, extra: Partial<Tab> = {}): Tab => ({
	id: `code:${path}`,
	kind: 'code',
	path,
	title: path.split('/').at(-1) ?? path,
	...extra,
});

function item(tab: Tab, label: string): MenuItem | undefined {
	return tabMenuItems(tab, 0).find((i): i is MenuItem => i !== 'separator' && i.label === label);
}

describe('tab context menu', () => {
	beforeEach(() => {
		useWorkbenchStore.getState().clearReveal();
		useLayoutStore.getState().showView('search');
	});

	it('reveals the tab file in the explorer view', () => {
		item(code('src/bot.py'), 'Reveal in Explorer View')?.onSelect();
		expect(useLayoutStore.getState().sideView).toBe('explorer');
		expect(useWorkbenchStore.getState().reveal?.path).toBe('src/bot.py');
	});

	it('counts a repeated reveal of the same file as a new request', () => {
		const tab = code('src/bot.py');
		item(tab, 'Reveal in Explorer View')?.onSelect();
		const first = useWorkbenchStore.getState().reveal?.nonce;
		useWorkbenchStore.getState().clearReveal();
		item(tab, 'Reveal in Explorer View')?.onSelect();
		expect(useWorkbenchStore.getState().reveal?.nonce).not.toBe(first);
	});

	it('offers no file actions for the scratchpad or virtual tabs', () => {
		const scratch = code('__scratch__', { title: 'Scratchpad' });
		const welcome: Tab = { id: 'welcome', kind: 'welcome', path: null, title: 'Welcome' };
		for (const tab of [scratch, welcome]) {
			expect(item(tab, 'Reveal in Explorer View')).toBeUndefined();
			expect(item(tab, 'Copy Path')).toBeUndefined();
		}
	});
});
