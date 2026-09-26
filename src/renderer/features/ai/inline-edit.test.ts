import type * as Monaco from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActiveEditor } from './editor-context';

const streamOnce = vi.fn<(options: { signal?: AbortSignal }) => Promise<string>>();
let active: ActiveEditor | null = null;

vi.mock('./requests', () => ({ streamOnce: (o: { signal?: AbortSignal }) => streamOnce(o) }));
vi.mock('../../lib/monaco/load', () => ({ getLoadedMonaco: () => null }));
vi.mock('../../stores/toast-store', () => ({ toast: { info: vi.fn(), error: vi.fn() } }));
vi.mock('./editor-context', () => ({
	activeEditor: () => active,
	fileContext: () => ({ kind: 'file', label: 'a.py', language: 'python', text: '' }),
	problemsContext: () => null,
}));

const { submitInlineEdit, rejectInlineEdit, startInlineEdit, useInlineEdit } =
	await import('./inline-edit');

type Listener = () => void;

/** A text model small enough to reason about: lines of text, edits applied in place. */
function fakeModel(initial: string): {
	model: Monaco.editor.ITextModel;
	text: () => string;
	undoStops: () => number;
	dispose: () => void;
} {
	let text = initial;
	let stops = 0;
	const willDispose: Listener[] = [];
	const offsetAt = (line: number, column: number): number =>
		text
			.split('\n')
			.slice(0, line - 1)
			.reduce((n, l) => n + l.length + 1, 0) +
		column -
		1;
	const model = {
		getValue: () => text,
		getLanguageId: () => 'python',
		getLineMaxColumn: (line: number) => (text.split('\n')[line - 1] ?? '').length + 1,
		getOffsetAt: (p: Monaco.IPosition) => offsetAt(p.lineNumber, p.column),
		getValueInRange: (r: Monaco.IRange) =>
			text.slice(
				offsetAt(r.startLineNumber, r.startColumn),
				offsetAt(r.endLineNumber, r.endColumn),
			),
		pushStackElement: () => {
			stops++;
		},
		pushEditOperations: (_: unknown, ops: Array<{ range: Monaco.IRange; text: string }>) => {
			for (const { range: r, text: t } of ops)
				text =
					text.slice(0, offsetAt(r.startLineNumber, r.startColumn)) +
					t +
					text.slice(offsetAt(r.endLineNumber, r.endColumn));
			return null;
		},
		onDidChangeContent: () => ({ dispose: () => undefined }),
		onWillDispose: (l: Listener) => {
			willDispose.push(l);
			return { dispose: () => undefined };
		},
	} as unknown as Monaco.editor.ITextModel;
	return {
		model,
		text: () => text,
		undoStops: () => stops,
		dispose: () => willDispose.forEach((l) => l()),
	};
}

function fakeEditor(
	model: Monaco.editor.ITextModel,
	selection: Monaco.IRange,
): { editor: Monaco.editor.IStandaloneCodeEditor; dispose: () => void; viewCalls: string[] } {
	const didDispose: Listener[] = [];
	const viewCalls: string[] = [];
	const collection = (items: Array<{ range: Monaco.IRange }>) => ({
		getRange: () => items[0]?.range ?? null,
		set: () => undefined,
		clear: () => viewCalls.push('clear'),
	});
	const editor = {
		getSelection: () => ({
			...selection,
			isEmpty: () =>
				selection.startLineNumber === selection.endLineNumber &&
				selection.startColumn === selection.endColumn,
		}),
		getModel: () => model,
		getLayoutInfo: () => ({ contentLeft: 0, contentWidth: 800, verticalScrollbarWidth: 14 }),
		addOverlayWidget: () => undefined,
		removeOverlayWidget: () => viewCalls.push('removeOverlayWidget'),
		changeViewZones: (cb: (a: unknown) => void) =>
			cb({ addZone: () => 'zone', removeZone: () => viewCalls.push('removeZone') }),
		createDecorationsCollection: collection,
		onDidChangeModel: () => ({ dispose: () => undefined }),
		onDidLayoutChange: () => ({ dispose: () => undefined }),
		onDidDispose: (l: Listener) => {
			didDispose.push(l);
			return { dispose: () => undefined };
		},
		revealLineInCenterIfOutsideViewport: () => undefined,
		focus: () => viewCalls.push('focus'),
	} as unknown as Monaco.editor.IStandaloneCodeEditor;
	return { editor, viewCalls, dispose: () => didDispose.forEach((l) => l()) };
}

const range = (sl: number, sc: number, el: number, ec: number): Monaco.IRange => ({
	startLineNumber: sl,
	startColumn: sc,
	endLineNumber: el,
	endColumn: ec,
});

function open(text: string, selection: Monaco.IRange) {
	const m = fakeModel(text);
	const e = fakeEditor(m.model, selection);
	active = {
		path: 'a.py',
		language: 'python',
		editor: e.editor,
		model: m.model,
		selection: null,
	};
	startInlineEdit();
	return { ...m, editor: e };
}

beforeEach(() => {
	vi.stubGlobal('document', { createElement: () => ({ style: {}, className: '' }) });
	streamOnce.mockReset();
	rejectInlineEdit();
});

describe('inline edit', () => {
	it('stops the request and closes the box when the editor is disposed', async () => {
		const { editor } = open('x = 1\n', range(1, 1, 1, 1));
		let signal: AbortSignal | undefined;
		streamOnce.mockImplementation((o) => {
			signal = o.signal;
			return new Promise(() => undefined);
		});
		void submitInlineEdit('add y');
		expect(useInlineEdit.getState().phase).toBe('generating');

		editor.dispose();

		expect(signal?.aborted).toBe(true);
		expect(useInlineEdit.getState().phase).toBeNull();
		// The view is gone with the editor: nothing is removed from it or focused.
		expect(editor.viewCalls).toEqual([]);
	});

	it('leaves the selection alone when the model returns no code', async () => {
		const m = open('def f():\n    return 1\n', range(1, 1, 2, 5));
		streamOnce.mockResolvedValue('   \n');

		await submitInlineEdit('rewrite');

		expect(m.text()).toBe('def f():\n    return 1\n');
		expect(useInlineEdit.getState()).toMatchObject({
			phase: 'prompt',
			error: 'The model returned no code. Try rephrasing the instruction.',
		});
	});
});
