import type * as Monaco from 'monaco-editor';

import { getSettings } from '../../../app/hooks/use-settings';
import type { MonacoApi } from '../../../lib/monaco/setup';

const TODO = /\b(TODO|FIXME|HACK|XXX|BUG|NOTE|OPTIMIZE|REVIEW)\b:?/g;
const TODO_CLASS: Record<string, string> = {
	TODO: 'anvil-todo-todo',
	FIXME: 'anvil-todo-fix',
	BUG: 'anvil-todo-fix',
	HACK: 'anvil-todo-hack',
	XXX: 'anvil-todo-hack',
	NOTE: 'anvil-todo-note',
	OPTIMIZE: 'anvil-todo-note',
	REVIEW: 'anvil-todo-note',
};
// Only in comments: `#`, `//`, `/*`, `*`, `--`, `<!--` somewhere before the marker.
const COMMENT_BEFORE = /(#|\/\/|\/\*|^\s*\*|--|<!--)/;
const RAINBOW_LEVELS = 6;
const MAX_LENS = 140;

/** Indentation levels of one line as [startColumn, endColumn) ranges (1-based). */
export function indentRanges(line: string, tabSize: number): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	let col = 0;
	let width = 0;
	let levelStart = 0;
	for (const ch of line) {
		if (ch === '\t') {
			out.push([col + 1, col + 2]);
			col++;
			levelStart = col;
			width = 0;
		} else if (ch === ' ') {
			col++;
			width++;
			if (width === tabSize) {
				out.push([levelStart + 1, col + 1]);
				levelStart = col;
				width = 0;
			}
		} else break;
	}
	return out;
}

/** TODO-style markers in comment text: [startColumn, endColumn, class]. */
export function todoMarkers(line: string): Array<[number, number, string]> {
	const out: Array<[number, number, string]> = [];
	for (const m of line.matchAll(TODO)) {
		const at = m.index ?? 0;
		if (!COMMENT_BEFORE.test(line.slice(0, at))) continue;
		out.push([at + 1, at + 1 + m[0].length, TODO_CLASS[m[1] ?? 'TODO'] ?? 'anvil-todo-todo']);
	}
	return out;
}

/**
 * Editor candy that makes code easier to scan: rainbow indentation, colored TODO markers,
 * and "error lens" (the problem message written after its line). Visible lines only, so it
 * stays cheap on big files.
 */
export function attachLens(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	const indent = editor.createDecorationsCollection();
	const todos = editor.createDecorationsCollection();
	const lens = editor.createDecorationsCollection();
	let timer: ReturnType<typeof setTimeout> | null = null;

	const paintVisible = (): void => {
		const model = editor.getModel();
		if (!model) {
			indent.clear();
			todos.clear();
			return;
		}
		const settings = getSettings();
		const tabSize = model.getOptions().tabSize;
		const indentDecos: Monaco.editor.IModelDeltaDecoration[] = [];
		const todoDecos: Monaco.editor.IModelDeltaDecoration[] = [];
		for (const range of editor.getVisibleRanges()) {
			const from = Math.max(1, range.startLineNumber - 20);
			const to = Math.min(model.getLineCount(), range.endLineNumber + 20);
			for (let ln = from; ln <= to; ln++) {
				const text = model.getLineContent(ln);
				if (settings.rainbowIndent && text.trim()) {
					indentRanges(text, tabSize).forEach(([a, b], level) => {
						indentDecos.push({
							range: new monaco.Range(ln, a, ln, b),
							options: { inlineClassName: `anvil-indent-${level % RAINBOW_LEVELS}` },
						});
					});
				}
				if (settings.todoHighlight) {
					for (const [a, b, cls] of todoMarkers(text)) {
						todoDecos.push({
							range: new monaco.Range(ln, a, ln, b),
							options: { inlineClassName: cls },
						});
					}
				}
			}
		}
		indent.set(indentDecos);
		todos.set(todoDecos);
	};

	const paintLens = (): void => {
		const model = editor.getModel();
		if (!model || !getSettings().errorLens) return lens.clear();
		const worst = new Map<number, Monaco.editor.IMarker>();
		for (const m of monaco.editor.getModelMarkers({ resource: model.uri })) {
			if (m.severity < monaco.MarkerSeverity.Warning) continue;
			const prev = worst.get(m.startLineNumber);
			if (!prev || m.severity > prev.severity) worst.set(m.startLineNumber, m);
		}
		const decos: Monaco.editor.IModelDeltaDecoration[] = [];
		for (const [line, m] of worst) {
			if (line > model.getLineCount()) continue;
			const error = m.severity === monaco.MarkerSeverity.Error;
			const text = m.message.split('\n')[0] ?? '';
			const end = model.getLineMaxColumn(line);
			decos.push({
				range: new monaco.Range(line, end, line, end),
				options: {
					isWholeLine: true,
					// The range is empty (end of line); without this Monaco drops the injected text.
					showIfCollapsed: true,
					className: error ? 'anvil-lens-line-error' : 'anvil-lens-line-warn',
					after: {
						content: `    ● ${text.length > MAX_LENS ? `${text.slice(0, MAX_LENS)}…` : text}`,
						inlineClassName: error ? 'anvil-lens-error' : 'anvil-lens-warn',
					},
				},
			});
		}
		lens.set(decos);
	};

	const schedule = (): void => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(paintVisible, 60);
	};
	const repaint = (): void => {
		paintVisible();
		paintLens();
	};

	const subs = [
		editor.onDidChangeModel(repaint),
		editor.onDidChangeModelContent(schedule),
		editor.onDidScrollChange(schedule),
		editor.onDidChangeModelOptions(schedule),
		monaco.editor.onDidChangeMarkers((uris) => {
			const model = editor.getModel();
			if (model && uris.some((u) => u.toString() === model.uri.toString())) paintLens();
		}),
	];
	window.addEventListener('anvil:appearance', repaint);
	repaint();
	return {
		dispose() {
			window.removeEventListener('anvil:appearance', repaint);
			if (timer) clearTimeout(timer);
			for (const s of subs) s.dispose();
			indent.clear();
			todos.clear();
			lens.clear();
		},
	};
}
