import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabsStore } from '../../stores/tabs-store';
import { useEditorStore } from './editor-store';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../app/hooks/use-settings', () => ({ getSettings: () => ({}) }));
vi.mock('../../lib/monaco/load', () => ({ loadMonaco: vi.fn(() => Promise.resolve({})) }));
vi.mock('./file-ops', () => ({
	SCRATCH_PATH: '__scratch__',
	isScratch: (path: string | null | undefined) => path === '__scratch__',
	openFile: vi.fn(() => Promise.resolve()),
	openScratch: vi.fn(),
	closeFile: vi.fn(),
}));

const { closeAllTabs, openPath, takeQuietOpen } = await import('./open');

describe('openPath focus', () => {
	beforeEach(() => {
		closeAllTabs();
		useEditorStore.getState().reset();
	});

	it('takes focus for a normal open', async () => {
		await openPath('C:/proj', { path: 'a.py' });
		expect(takeQuietOpen('a.py')).toBe(false);
	});

	it('marks previews and session restore as quiet, once', async () => {
		await openPath('C:/proj', { path: 'a.py', preview: true });
		await openPath('C:/proj', { path: 'b.py', focus: false });
		expect(takeQuietOpen('a.py')).toBe(true);
		expect(takeQuietOpen('a.py')).toBe(false);
		expect(takeQuietOpen('b.py')).toBe(true);
	});

	it('a later focused open clears the quiet mark', async () => {
		await openPath('C:/proj', { path: 'a.py', focus: false });
		await openPath('C:/proj', { path: 'a.py' });
		expect(takeQuietOpen('a.py')).toBe(false);
	});

	it('a reveal only focuses when the open does', async () => {
		await openPath('C:/proj', { path: 'a.py', line: 4, preview: true });
		expect(useEditorStore.getState().reveal).toMatchObject({ line: 4, focus: false });
		await openPath('C:/proj', { path: 'a.py', line: 9 });
		expect(useEditorStore.getState().reveal).toMatchObject({ line: 9, focus: true });
		expect(useTabsStore.getState().groups[0]?.tabIds).toEqual(['code:a.py']);
	});

	it('a reveal targets the group the file opens in', async () => {
		await openPath('C:/proj', { path: 'a.py' });
		await openPath('C:/proj', { path: 'a.py', line: 3, side: true });
		expect(useTabsStore.getState().groups.map((g) => g.id)).toEqual([0, 1]);
		expect(useEditorStore.getState().reveal).toMatchObject({ line: 3, group: 1 });
		useTabsStore.getState().focus(0);
		await openPath('C:/proj', { path: 'a.py', line: 7 });
		expect(useEditorStore.getState().reveal).toMatchObject({ line: 7, group: 0 });
	});
});
