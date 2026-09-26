import type * as Monaco from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toast } from '../../stores/toast-store';
import { insertAtCursors, replaceTargets } from './edit-actions';

vi.mock('../../lib/monaco/editors', () => ({ focusedEditor: () => null }));
vi.mock('../../stores/toast-store', () => ({
	toast: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('../../ui/QuickPick', () => ({ quickPick: vi.fn() }));
vi.mock('../editor/extras/clipboard', () => ({
	useClipboardHistory: { getState: () => ({ items: [] }) },
}));

type Range = Monaco.IRange;
type Edit = { range: Range; text: string };

const cursor = (line: number, column: number): Range & { isEmpty: () => boolean } => ({
	startLineNumber: line,
	startColumn: column,
	endLineNumber: line,
	endColumn: column,
	isEmpty: () => true,
});

const select = (
	startLine: number,
	startCol: number,
	endLine: number,
	endCol: number,
): Range & { isEmpty: () => boolean } => ({
	startLineNumber: startLine,
	startColumn: startCol,
	endLineNumber: endLine,
	endColumn: endCol,
	isEmpty: () => false,
});

/** Just enough of a Monaco editor for single-line ranges; rejects overlaps like Monaco does. */
function fakeEditor(
	lines: string[],
	selections: Array<Range & { isEmpty: () => boolean }>,
): { editor: Monaco.editor.IStandaloneCodeEditor; edits: Edit[] } {
	const edits: Edit[] = [];
	const line = (n: number): string => lines[n - 1] ?? '';
	const model = {
		getLineMaxColumn: (n: number) => line(n).length + 1,
		getValueInRange: (r: Range) =>
			line(r.startLineNumber).slice(r.startColumn - 1, r.endColumn - 1),
	};
	const editor = {
		getModel: () => model,
		getSelections: () => selections,
		pushUndoStop: () => true,
		focus: () => undefined,
		executeEdits: (_source: string, next: Edit[]) => {
			const sorted = [...next].sort(
				(a, b) =>
					a.range.startLineNumber - b.range.startLineNumber ||
					a.range.startColumn - b.range.startColumn,
			);
			for (let i = 1; i < sorted.length; i++) {
				const prev = sorted[i - 1]?.range;
				const cur = sorted[i]?.range;
				if (
					prev &&
					cur &&
					prev.endLineNumber === cur.startLineNumber &&
					cur.startColumn < prev.endColumn
				) {
					throw new Error('Overlapping ranges are not allowed!');
				}
			}
			edits.push(...next);
			return true;
		},
	};
	return { editor: editor as unknown as Monaco.editor.IStandaloneCodeEditor, edits };
}

describe('replaceTargets', () => {
	beforeEach(() => vi.clearAllMocks());

	it('treats an empty selection as its whole line', () => {
		const { editor, edits } = fakeEditor(['abc'], [cursor(1, 2)]);
		expect(replaceTargets(editor, (t) => t.toUpperCase())).toBe(true);
		expect(edits).toEqual([
			expect.objectContaining({
				text: 'ABC',
				range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 4 },
			}),
		]);
	});

	it('transforms a line once when two cursors sit on it', () => {
		const { editor, edits } = fakeEditor(['abc', 'def'], [cursor(1, 1), cursor(1, 3)]);
		expect(replaceTargets(editor, (t) => t.toUpperCase())).toBe(true);
		expect(edits.map((e) => e.text)).toEqual(['ABC']);
		expect(toast.warn).not.toHaveBeenCalled();
	});

	it('lets a real selection win over a cursor on the same line', () => {
		const { editor, edits } = fakeEditor(['abc def'], [cursor(1, 7), select(1, 1, 1, 4)]);
		expect(replaceTargets(editor, (t) => t.toUpperCase())).toBe(true);
		expect(edits.map((e) => e.text)).toEqual(['ABC']);
	});

	it('shows a toast instead of throwing when the edit is rejected', () => {
		const { editor } = fakeEditor(['abc'], [cursor(1, 1)]);
		editor.executeEdits = () => {
			throw new Error('read-only');
		};
		expect(replaceTargets(editor, (t) => t.toUpperCase(), 'Nope')).toBe(false);
		expect(toast.warn).toHaveBeenCalledWith('Nope', 'read-only');
	});
});

describe('insertAtCursors', () => {
	it('inserts the same text at every cursor', () => {
		const { editor, edits } = fakeEditor(['', ''], [cursor(1, 1), cursor(2, 1)]);
		insertAtCursors(editor, 'x');
		expect(edits.map((e) => e.text)).toEqual(['x', 'x']);
	});

	it('asks a factory for a fresh value per cursor', () => {
		const { editor, edits } = fakeEditor(
			['', '', ''],
			[cursor(1, 1), cursor(2, 1), cursor(3, 1)],
		);
		insertAtCursors(editor, (i) => `id-${i}`);
		expect(edits.map((e) => e.text)).toEqual(['id-0', 'id-1', 'id-2']);
	});
});
