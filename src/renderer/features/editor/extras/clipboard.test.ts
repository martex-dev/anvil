import type * as Monaco from 'monaco-editor';
import { beforeEach, describe, expect, it } from 'vitest';

import { attachClipboard, useClipboardHistory } from './clipboard';

interface FakeSelection {
	text: string;
	line: number;
}

/** An editor whose DOM node can receive copy / cut events. */
function fakeEditor(
	selections: FakeSelection[],
	focused = true,
): { node: EventTarget; editor: Monaco.editor.IStandaloneCodeEditor } {
	const node = new EventTarget();
	const lines = ['first line', 'second line'];
	const editor = {
		getDomNode: () => node,
		hasTextFocus: () => focused,
		getModel: () => ({
			getLineContent: (n: number) => lines[n - 1] ?? '',
			getValueInRange: (sel: { text: string }) => sel.text,
		}),
		getSelections: () =>
			selections.map((s) => ({ ...s, isEmpty: () => !s.text, startLineNumber: s.line })),
	} as unknown as Monaco.editor.IStandaloneCodeEditor;
	return { node, editor };
}

describe('editor clipboard history', () => {
	beforeEach(() => useClipboardHistory.getState().clear());

	it('records copies and cuts however they were triggered (menu, Ctrl+Insert)', () => {
		const { node, editor } = fakeEditor([{ text: 'x = 1', line: 1 }]);
		const sub = attachClipboard(editor, () => 'a.py');
		node.dispatchEvent(new Event('copy'));
		expect(useClipboardHistory.getState().items[0]).toMatchObject({
			text: 'x = 1',
			source: 'a.py',
		});
		sub.dispose();
		node.dispatchEvent(new Event('cut'));
		expect(useClipboardHistory.getState().items).toHaveLength(1);
	});

	it('copies the whole line for an empty selection', () => {
		const { node, editor } = fakeEditor([{ text: '', line: 2 }]);
		attachClipboard(editor, () => null);
		node.dispatchEvent(new Event('cut'));
		expect(useClipboardHistory.getState().items[0]?.text).toBe('second line\n');
	});

	it("ignores copies from the editor's own inputs (find, rename)", () => {
		const { node, editor } = fakeEditor([{ text: 'x = 1', line: 1 }], false);
		attachClipboard(editor, () => null);
		node.dispatchEvent(new Event('copy'));
		expect(useClipboardHistory.getState().items).toEqual([]);
	});
});
