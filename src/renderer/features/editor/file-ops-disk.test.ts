import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../lib/monaco/setup';
import { useToastStore } from '../../stores/toast-store';
import { useEditorStore } from './editor-store';

// Keeping buffers in step with the disk: reloads, watcher events and their races with saves.
const call = vi.fn();
vi.mock('../../lib/ipc', () => ({
	call: (...args: unknown[]): unknown => call(...args),
	IpcCallError: class extends Error {},
}));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../app/hooks/use-settings', () => ({ getSettings: () => ({}) }));

const { closeFile, onExternalChange, openFile, reloadFromDisk, saveFile } =
	await import('./file-ops');

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

describe('file ops and the disk', () => {
	beforeEach(() => {
		for (const f of [...useEditorStore.getState().files]) closeFile(f.path);
		useEditorStore.getState().reset();
		call.mockReset();
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

	it('does not flag an edited file for the watcher echo of its own save', async () => {
		call.mockResolvedValue(text);
		await openFile(monaco, 'C:/proj', 'a.py');
		useEditorStore.getState().update('a.py', { dirty: true });
		call.mockImplementation((channel: string) =>
			Promise.resolve(channel === 'fs:writeFile' ? { mtimeMs: 5 } : { ...text, mtimeMs: 5 }),
		);
		await saveFile('a.py');
		// You keep typing right after Ctrl+S; then the watcher reports the save.
		useEditorStore.getState().update('a.py', { dirty: true });
		call.mockClear();
		onExternalChange(['a.py']);
		await vi.waitFor(() => expect(call).toHaveBeenCalledWith('fs:readFile', 'a.py'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(useEditorStore.getState().files[0]).toMatchObject({
			changedOnDisk: false,
			dirty: true,
		});
		// A real change by another program still flags it.
		call.mockResolvedValue({ ...text, mtimeMs: 9 });
		onExternalChange(['a.py']);
		await vi.waitFor(() =>
			expect(useEditorStore.getState().files[0]?.changedOnDisk).toBe(true),
		);
	});

	it('judges an echo that arrives mid-save against the mtime the save writes', async () => {
		call.mockResolvedValue(text);
		await openFile(monaco, 'C:/proj', 'a.py');
		useEditorStore.getState().update('a.py', { dirty: true });
		let finishWrite = (): void => undefined;
		call.mockImplementation((channel: string) =>
			channel === 'fs:writeFile'
				? new Promise((resolve) => {
						finishWrite = () => resolve({ mtimeMs: 5 });
					})
				: Promise.resolve({ ...text, mtimeMs: 5 }),
		);
		const saved = saveFile('a.py');
		await vi.waitFor(() =>
			expect(call).toHaveBeenCalledWith('fs:writeFile', expect.anything()),
		);
		call.mockClear();
		onExternalChange(['a.py']);
		finishWrite();
		await saved;
		await vi.waitFor(() => expect(call).toHaveBeenCalledWith('fs:readFile', 'a.py'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(useEditorStore.getState().files[0]).toMatchObject({
			changedOnDisk: false,
			mtimeMs: 5,
		});
	});
	it("writes a file back with its BOM and encoding, following the disk version's", async () => {
		call.mockResolvedValue({ ...text, bom: true, encoding: 'windows-1252' });
		await openFile(monaco, 'C:/proj', 'prices.csv');
		call.mockResolvedValue({ mtimeMs: 2 });
		await saveFile('prices.csv', true);
		expect(call).toHaveBeenLastCalledWith(
			'fs:writeFile',
			expect.objectContaining({ bom: true, encoding: 'windows-1252' }),
		);
		call.mockResolvedValue({ ...text, mtimeMs: 3, bom: false, encoding: 'utf8' });
		await reloadFromDisk('prices.csv');
		call.mockResolvedValue({ mtimeMs: 4 });
		await saveFile('prices.csv', true);
		expect(call).toHaveBeenLastCalledWith(
			'fs:writeFile',
			expect.objectContaining({ bom: false, encoding: 'utf8' }),
		);
	});
});
