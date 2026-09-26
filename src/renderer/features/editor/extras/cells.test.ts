import type * as Monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';

import type { MonacoApi } from '../../../lib/monaco/setup';
import { attachCells } from './cells';

const GLYPH = 2;

const monaco = {
	Range: function Range(): void {},
	editor: {
		MouseTargetType: { GUTTER_GLYPH_MARGIN: GLYPH },
		GlyphMarginLane: { Left: 1, Right: 3 },
	},
} as unknown as MonacoApi;

type MouseHandler = (e: Monaco.editor.IEditorMouseEvent) => void;

/** Just enough editor to attach the cells extra and click its gutter. */
function fakeEditor(): { editor: Monaco.editor.IStandaloneCodeEditor; click: MouseHandler } {
	const lines = ['# %% Load', 'x = 1'];
	const model = {
		getLanguageId: () => 'python',
		getLinesContent: () => lines,
		getLineContent: (n: number) => lines[n - 1] ?? '',
	};
	const noop = { dispose: () => undefined };
	let click: MouseHandler = () => undefined;
	const editor = {
		createDecorationsCollection: () => ({ set: () => [], clear: () => undefined }),
		getModel: () => model,
		getPosition: () => null,
		onDidChangeModel: () => noop,
		onDidChangeModelLanguage: () => noop,
		onDidChangeModelContent: () => noop,
		onDidChangeCursorPosition: () => noop,
		onMouseDown: (handler: MouseHandler) => {
			click = handler;
			return noop;
		},
	} as unknown as Monaco.editor.IStandaloneCodeEditor;
	return { editor, click: (e) => click(e) };
}

const mouse = (event: Partial<Monaco.IMouseEvent>): Monaco.editor.IEditorMouseEvent =>
	({
		target: { type: GLYPH, position: { lineNumber: 1 } },
		event: {
			leftButton: false,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			metaKey: false,
			...event,
		},
	}) as unknown as Monaco.editor.IEditorMouseEvent;

describe('cell glyph', () => {
	it('runs the cell on a plain left click only', () => {
		const run = vi.fn();
		const { editor, click } = fakeEditor();
		attachCells(editor, monaco, run);
		click(mouse({ rightButton: true }));
		click(mouse({ middleButton: true }));
		click(mouse({ leftButton: true, ctrlKey: true }));
		click(mouse({ leftButton: true, shiftKey: true }));
		expect(run).not.toHaveBeenCalled();
		click(mouse({ leftButton: true }));
		expect(run).toHaveBeenCalledWith(1);
	});
});
