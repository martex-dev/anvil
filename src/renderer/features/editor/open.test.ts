import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../lib/monaco/setup';
import { useTabsStore } from '../../stores/tabs-store';
import { useToastStore } from '../../stores/toast-store';
import { useEditorStore } from './editor-store';

const call = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../app/hooks/use-settings', () => ({ getSettings: () => ({}) }));
const loadMonaco = vi.fn(() => Promise.resolve({}));
vi.mock('../../lib/monaco/load', () => ({ loadMonaco: () => loadMonaco() }));
const openFile = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('./file-ops', () => ({
	SCRATCH_PATH: '__scratch__',
	isScratch: (path: string | null | undefined) => path === '__scratch__',
	openFile: (...args: unknown[]) => openFile(...args),
	openScratch: vi.fn(),
	closeFile: vi.fn(),
}));

const {
	canOpenAsTable,
	closeAllTabs,
	closeOtherTabs,
	closeTab,
	openPath,
	openUnloadedFiles,
	remembersRecent,
	takeQuietOpen,
} = await import('./open');
const monaco = {} as MonacoApi;

describe('openPath focus', () => {
	beforeEach(() => {
		closeAllTabs();
		useEditorStore.getState().reset();
		openFile.mockClear();
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

describe('opening to the side', () => {
	beforeEach(() => {
		closeAllTabs();
		useEditorStore.getState().reset();
	});

	it('leaves the focused group showing what it showed', async () => {
		await openPath('C:/proj', { path: 'README.md' });
		await openPath('C:/proj', { path: 'README.md', as: 'markdown', side: true });
		const [left, right] = useTabsStore.getState().groups;
		expect(left).toMatchObject({ tabIds: ['code:README.md'], active: 'code:README.md' });
		expect(right).toMatchObject({
			tabIds: ['markdown:README.md'],
			active: 'markdown:README.md',
		});
	});
});

describe('closing several dirty tabs', () => {
	beforeEach(() => {
		closeAllTabs();
		useEditorStore.getState().reset();
	});

	it('asks about each of them', async () => {
		for (const path of ['a.py', 'b.py', 'c.py']) {
			await openPath('C:/proj', { path });
			useEditorStore.getState().add({
				path,
				name: path,
				state: 'ready',
				dirty: true,
				mtimeMs: 0,
				changedOnDisk: false,
			});
		}
		closeOtherTabs(0, 'code:a.py');
		expect(useEditorStore.getState().closing).toEqual(['b.py', 'c.py']);
		// Both stay open until each is answered.
		expect(useTabsStore.getState().groups[0]?.tabIds).toEqual([
			'code:a.py',
			'code:b.py',
			'code:c.py',
		]);
	});
});

describe('closing a table', () => {
	beforeEach(() => {
		closeAllTabs();
		call.mockClear();
	});

	it('keeps its data while the other group still shows it', async () => {
		await openPath('C:/proj', { path: 'prices.csv' });
		await openPath('C:/proj', { path: 'prices.csv', side: true });
		closeTab(1, 'data:prices.csv');
		expect(call).not.toHaveBeenCalled();
		closeTab(0, 'data:prices.csv');
		expect(call).toHaveBeenCalledWith('data:evict', 'prices.csv');
	});
});

describe('opening files after Monaco failed to load', () => {
	beforeEach(() => {
		closeAllTabs();
		useEditorStore.getState().reset();
		openFile.mockClear();
	});

	it('reads the files of tabs opened during the failure once Monaco is up', async () => {
		loadMonaco.mockRejectedValueOnce(new Error('boom'));
		loadMonaco.mockRejectedValueOnce(new Error('boom'));
		await openPath('C:/proj', { path: 'a.py' });
		await openPath('C:/proj', { path: 'b.py' });
		expect(openFile).not.toHaveBeenCalled();
		// The editor area's error state reports it once; no toast per file.
		expect(useToastStore.getState().toasts).toEqual([]);
		// b.py's tab was closed in the meantime; only a.py is still waiting.
		useTabsStore.getState().close(0, 'code:b.py');
		await openUnloadedFiles(monaco);
		expect(openFile).toHaveBeenCalledTimes(1);
		expect(openFile).toHaveBeenCalledWith(monaco, 'C:/proj', 'a.py');
		// Done once: a second pass has nothing left to load.
		await openUnloadedFiles(monaco);
		expect(openFile).toHaveBeenCalledTimes(1);
	});
});

describe('canOpenAsTable', () => {
	it('accepts the formats the data grid reads', () => {
		for (const path of ['a.csv', 'b.TSV', 'c.parquet', 'd.json', 'e.ndjson', 'f.xlsx'])
			expect(canOpenAsTable(path), path).toBe(true);
		for (const path of ['a.py', 'b.bin', 'c.json.bak'])
			expect(canOpenAsTable(path), path).toBe(false);
	});
});

describe('openPath after its tab closed', () => {
	it('does not read a file whose tab closed while Monaco loaded', async () => {
		let finish = (): void => undefined;
		loadMonaco.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = () => resolve({});
			}),
		);
		openFile.mockClear();
		const opening = openPath('C:/old', { path: 'a.py', focus: false });
		// The folder changes mid-restore: every tab of the old one closes.
		closeAllTabs();
		finish();
		await opening;
		expect(openFile).not.toHaveBeenCalled();
	});
});

describe('remembersRecent', () => {
	it('keeps explicit opens and skips navigation and the scratchpad', () => {
		expect(remembersRecent({ path: 'a.py' })).toBe(true);
		expect(remembersRecent({ path: 'a.py', line: 3, remember: false })).toBe(false);
		expect(remembersRecent({ path: '__scratch__' })).toBe(false);
	});
});
