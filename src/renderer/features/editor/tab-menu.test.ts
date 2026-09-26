import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '../../stores/layout-store';
import { type Tab, useTabsStore } from '../../stores/tabs-store';
import { useToastStore } from '../../stores/toast-store';
import { useWorkbenchStore } from '../../stores/workbench-store';
import type { MenuItem } from '../../ui/ContextMenu';

const call = vi.fn((_channel: string, input: { path: string; absolute: boolean }) =>
	Promise.resolve(input.absolute ? `C:\\proj\\${input.path.replace(/\//g, '\\')}` : input.path),
);
vi.mock('../../lib/ipc', () => ({
	call: (channel: string, input: { path: string; absolute: boolean }) => call(channel, input),
}));
const writeText = vi.fn((_text: string) => Promise.resolve());
vi.stubGlobal('navigator', { clipboard: { writeText: (text: string) => writeText(text) } });
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

	it('copies the absolute or relative path and confirms it', async () => {
		const tab = code('src/bot.py');
		item(tab, 'Copy Path')?.onSelect();
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('C:\\proj\\src\\bot.py'));
		item(tab, 'Copy Relative Path')?.onSelect();
		await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith('src/bot.py'));
		expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
			tone: 'success',
			title: 'Path copied',
		});
	});

	it('reports a failed copy instead of dropping it', async () => {
		writeText.mockRejectedValueOnce(new Error('Clipboard blocked'));
		item(code('src/bot.py'), 'Copy Path')?.onSelect();
		await vi.waitFor(() =>
			expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
				tone: 'error',
				description: 'Clipboard blocked',
			}),
		);
	});

	it('keeps a preview tab open', () => {
		const tab = code('src/bot.py', { preview: true });
		useTabsStore.getState().reset();
		useTabsStore.getState().open(tab);
		item(tab, 'Keep Open')?.onSelect();
		expect(useTabsStore.getState().tabs[tab.id]?.preview).toBe(false);
		expect(item(code('src/bot.py'), 'Keep Open')).toBeUndefined();
	});
});
