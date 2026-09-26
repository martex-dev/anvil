import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../lib/monaco/setup';
import { useTabsStore } from '../../stores/tabs-store';
import { useEditorStore } from './editor-store';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({
	call: (...args: unknown[]): unknown => call(...args),
	IpcCallError: class extends Error {},
}));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../app/hooks/use-settings', () => ({ getSettings: () => ({}) }));

interface FakeModel {
	uri: { path: string };
	getValue: () => string;
	disposed: boolean;
	version: number;
}

/** A text model whose version the test bumps to simulate typing. */
function fakeModel(text: string, _language: unknown, uri: { path: string }): unknown {
	const model = {
		uri,
		disposed: false,
		version: 1,
		getValue: () => text,
		setValue: (next: string) => (text = next),
		getAlternativeVersionId: () => model.version,
		onDidChangeContent: () => ({ dispose: () => undefined }),
		setEOL: () => undefined,
		getEOL: () => '\n',
		isDisposed: () => model.disposed,
		dispose: () => (model.disposed = true),
	};
	return model;
}

const monaco = {
	Uri: { file: (path: string) => ({ path }) },
	editor: {
		getModel: () => null,
		createModel: fakeModel,
		EndOfLineSequence: { LF: 0, CRLF: 1 },
	},
} as unknown as MonacoApi;
vi.mock('../../lib/monaco/load', () => ({ getLoadedMonaco: () => monaco, loadMonaco: vi.fn() }));
vi.mock('../../lib/monaco/editors', () => ({ groupEditors: () => [], focusedEditor: () => null }));

const { closeFile, getModel, openFile } = await import('./file-ops');
const { renameOpenPath } = await import('./rename');
const { tabFor } = await import('./open');

async function open(path: string): Promise<void> {
	call.mockResolvedValueOnce({
		content: `# ${path}\n`,
		eol: '\n',
		mtimeMs: 1,
		binary: false,
		tooLarge: false,
	});
	useTabsStore.getState().open(tabFor(path, 'code'));
	await openFile(monaco, 'C:/proj', path);
}

describe('renameOpenPath', () => {
	beforeEach(() => {
		for (const f of [...useEditorStore.getState().files]) closeFile(f.path);
		useEditorStore.getState().reset();
		useTabsStore.getState().reset();
	});

	it('moves the tab, buffer and unsaved edits of a renamed file', async () => {
		await open('src/a.py');
		const before = getModel('src/a.py') as unknown as FakeModel;
		before.version = 2;
		useEditorStore.getState().update('src/a.py', { dirty: true });
		renameOpenPath('C:/proj', 'src/a.py', 'src/b.py');
		const after = getModel('src/b.py') as unknown as FakeModel;
		expect(getModel('src/a.py')).toBeNull();
		expect(before.disposed).toBe(true);
		expect(after.uri.path).toBe('C:/proj/src/b.py');
		expect(after.getValue()).toBe('# src/a.py\n');
		expect(useEditorStore.getState().files).toEqual([
			expect.objectContaining({ path: 'src/b.py', name: 'b.py', dirty: true }),
		]);
		const { tabs, groups } = useTabsStore.getState();
		expect(Object.keys(tabs)).toEqual(['code:src/b.py']);
		expect(tabs['code:src/b.py']).toMatchObject({ path: 'src/b.py', title: 'b.py' });
		expect(groups[0]).toMatchObject({ tabIds: ['code:src/b.py'], active: 'code:src/b.py' });
	});

	it('moves everything inside a renamed folder, and nothing else', async () => {
		await open('src/a.py');
		await open('srcx/c.py');
		renameOpenPath('C:/proj', 'src', 'lib');
		expect(useEditorStore.getState().files.map((f) => f.path)).toEqual([
			'lib/a.py',
			'srcx/c.py',
		]);
		expect(Object.keys(useTabsStore.getState().tabs).sort()).toEqual([
			'code:lib/a.py',
			'code:srcx/c.py',
		]);
		expect(getModel('lib/a.py')?.getValue()).toBe('# src/a.py\n');
	});
});
