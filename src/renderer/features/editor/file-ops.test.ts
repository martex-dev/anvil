import type * as Monaco from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../lib/monaco/setup';
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
});
