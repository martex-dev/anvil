import type * as Monaco from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../lib/monaco/setup';
import { codeTabId, useTabsStore } from '../../stores/tabs-store';
import { useEditorStore } from './editor-store';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({
	call: (...args: unknown[]): unknown => call(...args),
	IpcCallError: class extends Error {},
}));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../app/hooks/use-settings', () => ({ getSettings: () => ({}) }));

const { closeFile, getViewState, openFile, saveViewState } = await import('./file-ops');

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
		useTabsStore
			.getState()
			.open({
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
});
