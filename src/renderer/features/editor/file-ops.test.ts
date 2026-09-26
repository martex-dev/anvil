import type * as Monaco from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../lib/monaco/setup';
import { codeTabId, useTabsStore } from '../../stores/tabs-store';
import { useToastStore } from '../../stores/toast-store';
import { useEditorStore } from './editor-store';

const call = vi.fn();
const { IpcCallError } = vi.hoisted(() => ({
	IpcCallError: class extends Error {
		constructor(
			readonly code: string,
			message: string,
		) {
			super(message);
		}
	},
}));
vi.mock('../../lib/ipc', () => ({
	call: (...args: unknown[]): unknown => call(...args),
	IpcCallError,
}));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../app/hooks/use-settings', () => ({ getSettings: () => ({}) }));

const {
	closeFile,
	getModel,
	getViewState,
	onExternalChange,
	openFile,
	reloadFromDisk,
	saveAll,
	saveFile,
	saveViewState,
} = await import('./file-ops');

/** Just enough of a text model for openFile / closeFile. */
function fakeModel(text: string): unknown {
	let value = text;
	return {
		getValue: () => value,
		setValue: (next: string) => (value = next),
		getAlternativeVersionId: () => 1,
		onDidChangeContent: () => ({ dispose: () => undefined }),
		setEOL: () => undefined,
		isDisposed: () => false,
		dispose: () => undefined,
	};
}

const monaco = {
	Uri: { file: (path: string) => ({ path }) },
	editor: {
		getModel: () => null,
		createModel: fakeModel,
		EndOfLineSequence: { LF: 0, CRLF: 1 },
	},
} as unknown as MonacoApi;

const text = { content: 'x = 1\n', eol: '\n', mtimeMs: 1, binary: false, tooLarge: false };
const view = (line: number): Monaco.editor.ICodeEditorViewState =>
	({ cursorState: [], viewState: { scrollTop: line }, contributionsState: {} }) as never;

describe('file ops', () => {
	beforeEach(() => {
		for (const f of [...useEditorStore.getState().files]) closeFile(f.path);
		useEditorStore.getState().reset();
		call.mockReset();
	});

	it('keeps a separate view state per editor group', async () => {
		call.mockResolvedValue(text);
		await openFile(monaco, 'C:/proj', 'a.py');
		const left = view(10);
		const right = view(200);
		saveViewState('a.py', 0, left);
		saveViewState('a.py', 1, right);
		expect(getViewState('a.py', 0)).toBe(left);
		expect(getViewState('a.py', 1)).toBe(right);
		closeFile('a.py');
		expect(getViewState('a.py', 0)).toBeNull();
	});

	it('retries a failed read when the file is opened again', async () => {
		call.mockRejectedValueOnce(new Error('EBUSY: file is locked'));
		await openFile(monaco, 'C:/proj', 'a.py');
		expect(useEditorStore.getState().files[0]).toMatchObject({
			state: 'error',
			error: 'EBUSY: file is locked',
		});
		call.mockResolvedValueOnce(text);
		await openFile(monaco, 'C:/proj', 'a.py');
		expect(useEditorStore.getState().files).toHaveLength(1);
		expect(useEditorStore.getState().files[0]).toMatchObject({
			state: 'ready',
			error: undefined,
		});
	});

	it('does not re-read a file that is already open', async () => {
		call.mockResolvedValue(text);
		await openFile(monaco, 'C:/proj', 'a.py');
		await openFile(monaco, 'C:/proj', 'a.py');
		expect(call).toHaveBeenCalledTimes(1);
	});

	it('turns an edited preview into a regular tab', async () => {
		let version = 1;
		let onChange = (): void => undefined;
		const editable = {
			...monaco,
			editor: {
				...monaco.editor,
				createModel: (value: string) => ({
					...(fakeModel(value) as object),
					getAlternativeVersionId: () => version,
					onDidChangeContent: (listener: () => void) => {
						onChange = listener;
						return { dispose: () => undefined };
					},
				}),
			},
		} as unknown as MonacoApi;
		useTabsStore.getState().reset();
		useTabsStore.getState().open({
			id: codeTabId('a.py'),
			kind: 'code',
			path: 'a.py',
			title: 'a.py',
			preview: true,
		});
		call.mockResolvedValue(text);
		await openFile(editable, 'C:/proj', 'a.py');
		version = 2;
		onChange();
		expect(useEditorStore.getState().files[0]?.dirty).toBe(true);
		expect(useTabsStore.getState().tabs[codeTabId('a.py')]?.preview).toBe(false);
	});

	it('does not rewrite a file without changes', async () => {
		call.mockResolvedValue(text);
		await openFile(monaco, 'C:/proj', 'a.py');
		call.mockClear();
		expect(await saveFile('a.py')).toBe(true);
		expect(call).not.toHaveBeenCalled();
	});

	it('reloads a changed file by editing only the changed lines', async () => {
		const pushEditOperations = vi.fn();
		const reloadable = {
			...monaco,
			editor: {
				...monaco.editor,
				createModel: (value: string) => ({
					...(fakeModel(value) as object),
					getLinesContent: () => value.split('\n'),
					getEOL: () => '\n',
					getFullModelRange: () => 'everything',
					pushEditOperations,
				}),
			},
		} as unknown as MonacoApi;
		call.mockResolvedValue({ ...text, content: 'a = 1\nb = 2\nc = 3\n' });
		await openFile(reloadable, 'C:/proj', 'a.py');
		call.mockResolvedValue({ ...text, content: 'a = 1\nb = 20\nc = 3\n' });
		await reloadFromDisk('a.py');
		expect(pushEditOperations).toHaveBeenCalledWith(
			[],
			[
				{
					range: { startLineNumber: 2, startColumn: 6, endLineNumber: 2, endColumn: 6 },
					text: '0',
				},
			],
			expect.any(Function),
		);
	});

	it('drops a read that lands after its tab closed', async () => {
		const createModel = vi.fn(fakeModel);
		const counting = {
			...monaco,
			editor: { ...monaco.editor, createModel },
		} as unknown as MonacoApi;
		let finish = (): void => undefined;
		call.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = () => resolve(text);
			}),
		);
		const opening = openFile(counting, 'C:/proj', 'a.py');
		closeFile('a.py');
		finish();
		await opening;
		expect(createModel).not.toHaveBeenCalled();
		expect(useEditorStore.getState().files).toEqual([]);
	});

	it('does not fill a reopened file with a read from the previous folder', async () => {
		let finishOld = (): void => undefined;
		call.mockReturnValueOnce(
			new Promise((resolve) => {
				finishOld = () => resolve({ ...text, content: 'old = 1\n', mtimeMs: 5 });
			}),
		);
		const old = openFile(monaco, 'C:/old', 'a.py');
		// The folder switches: every buffer closes and the new folder opens its own a.py.
		closeFile('a.py');
		call.mockResolvedValueOnce({ ...text, content: 'new = 1\n', mtimeMs: 9 });
		await openFile(monaco, 'C:/new', 'a.py');
		finishOld();
		await old;
		expect(useEditorStore.getState().files).toHaveLength(1);
		expect(useEditorStore.getState().files[0]).toMatchObject({ state: 'ready', mtimeMs: 9 });
		expect(getModel('a.py')?.getValue()).toBe('new = 1\n');
	});

	it('runs a second save after the first, with the mtime the first one wrote', async () => {
		let version = 1;
		let onChange = (): void => undefined;
		const editable = {
			...monaco,
			editor: {
				...monaco.editor,
				createModel: (value: string) => ({
					...(fakeModel(value) as object),
					getAlternativeVersionId: () => version,
					onDidChangeContent: (listener: () => void) => {
						onChange = listener;
						return { dispose: () => undefined };
					},
				}),
			},
		} as unknown as MonacoApi;
		call.mockResolvedValue(text);
		await openFile(editable, 'C:/proj', 'a.py');
		const writes: unknown[] = [];
		call.mockImplementation((channel: string, input: unknown) => {
			if (channel !== 'fs:writeFile') return Promise.resolve(text);
			writes.push(input);
			// Typing continues while the first write is on its way.
			version += 1;
			onChange();
			return Promise.resolve({ mtimeMs: 10 + writes.length });
		});
		version = 2;
		onChange();
		const first = saveFile('a.py');
		const second = saveFile('a.py');
		expect(await first).toBe(true);
		expect(await second).toBe(true);
		expect(writes).toEqual([
			expect.objectContaining({ expectedMtimeMs: 1 }),
			expect.objectContaining({ expectedMtimeMs: 11 }),
		]);
		expect(useEditorStore.getState().conflicts).toEqual([]);
	});

	it('keeps keystrokes typed while a reload read is in flight', async () => {
		let version = 1;
		const pushEditOperations = vi.fn();
		const editable = {
			...monaco,
			editor: {
				...monaco.editor,
				createModel: (value: string) => ({
					...(fakeModel(value) as object),
					getAlternativeVersionId: () => version,
					getLinesContent: () => value.split('\n'),
					getEOL: () => '\n',
					getFullModelRange: () => 'everything',
					pushEditOperations,
				}),
			},
		} as unknown as MonacoApi;
		call.mockResolvedValue(text);
		await openFile(editable, 'C:/proj', 'a.py');
		call.mockImplementation(() => {
			version = 2;
			return Promise.resolve({ ...text, content: 'disk = 1\n', mtimeMs: 7 });
		});
		await reloadFromDisk('a.py');
		expect(pushEditOperations).not.toHaveBeenCalled();
		expect(useEditorStore.getState().files[0]).toMatchObject({
			changedOnDisk: true,
			mtimeMs: 1,
		});
	});

	it('ignores the watcher echo of its own save', async () => {
		const pushEditOperations = vi.fn();
		const editable = {
			...monaco,
			editor: {
				...monaco.editor,
				createModel: (value: string) => ({
					...(fakeModel(value) as object),
					pushEditOperations,
				}),
			},
		} as unknown as MonacoApi;
		call.mockResolvedValue(text);
		await openFile(editable, 'C:/proj', 'a.py');
		call.mockResolvedValue({ ...text, content: 'x = 2\n' });
		onExternalChange(['a.py']);
		await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(2));
		await Promise.resolve();
		expect(pushEditOperations).not.toHaveBeenCalled();
		expect(useEditorStore.getState().files[0]?.changedOnDisk).toBe(false);
	});

	it('says why Load Disk Version changed nothing', async () => {
		call.mockResolvedValue(text);
		await openFile(monaco, 'C:/proj', 'src/a.py');
		call.mockRejectedValueOnce(new Error('ENOENT: no such file'));
		await reloadFromDisk('src/a.py');
		expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
			tone: 'error',
			title: "Couldn't reload a.py",
			description: 'ENOENT: no such file',
		});
		call.mockResolvedValueOnce({ ...text, content: '', binary: true });
		await reloadFromDisk('src/a.py');
		expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
			tone: 'warn',
			title: "Couldn't reload a.py",
		});
		expect(useEditorStore.getState().files[0]?.changedOnDisk).toBe(true);
	});

	it('builds file URIs for a drive-root folder without a doubled slash', async () => {
		const file = vi.fn((path: string) => ({ path }));
		const driveRoot = { ...monaco, Uri: { file } } as unknown as MonacoApi;
		call.mockResolvedValue(text);
		await openFile(driveRoot, 'D:\\', 'src/a.py');
		expect(file).toHaveBeenCalledWith('D:/src/a.py');
	});

	it('asks about every conflict Save All runs into', async () => {
		call.mockResolvedValue(text);
		await openFile(monaco, 'C:/proj', 'a.py');
		await openFile(monaco, 'C:/proj', 'b.py');
		useEditorStore.getState().update('a.py', { dirty: true });
		useEditorStore.getState().update('b.py', { dirty: true });
		call.mockRejectedValue(new IpcCallError('FS_CONFLICT', 'changed on disk'));
		await saveAll();
		expect(useEditorStore.getState().conflicts).toEqual(['a.py', 'b.py']);
		expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
			title: '2 files were not saved',
			description: 'a.py, b.py',
		});
		closeFile('a.py');
		expect(useEditorStore.getState().conflicts).toEqual(['b.py']);
	});
});
