import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../../lib/monaco/setup';
import { outlineFor, type OutlineSymbol, symbolPath } from '../../outline/outline';
import { type Cell, cellAt, findCells } from '../../python/cells';
import { cellsOf, linesOf, outlineOf } from './model-structure';

let enabled = false;

export function isSpotlightOn(): boolean {
	return enabled;
}

export function toggleSpotlight(): boolean {
	enabled = !enabled;
	window.dispatchEvent(new CustomEvent('anvil:spotlight'));
	return enabled;
}

/** Cells and outline of the text, when the caller already has them (cached per model). */
interface Parsed {
	cells: () => readonly Cell[];
	outline: () => readonly OutlineSymbol[];
}

/**
 * The block to keep lit around a line: its `# %%` cell, else the innermost function/class,
 * else the paragraph (run of non-blank lines).
 */
export function spotlightBlock(
	language: string,
	lines: readonly string[],
	line: number,
	parsed: Parsed = {
		cells: () => (language === 'python' ? findCells(lines) : []),
		outline: () => outlineFor(language, lines),
	},
): { start: number; end: number } {
	const cell = language === 'python' ? cellAt(parsed.cells(), line) : null;
	if (cell) return { start: cell.start, end: cell.end };
	const symbol = symbolPath(parsed.outline(), line).at(-1);
	if (symbol) {
		let end = symbol.end;
		while (end > symbol.line && !lines[end - 1]?.trim()) end--;
		return { start: symbol.line, end };
	}
	let start = line;
	let end = line;
	while (start > 1 && lines[start - 2]?.trim()) start--;
	while (end < lines.length && lines[end]?.trim()) end++;
	return { start, end };
}

/** Spotlight mode: everything outside the block you're in fades back. */
export function attachSpotlight(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	const dim = editor.createDecorationsCollection();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const paint = (): void => {
		clearTimeout(timer);
		timer = undefined;
		const model = editor.getModel();
		const pos = editor.getPosition();
		if (!enabled || !model || !pos) return dim.clear();
		const { start, end } = spotlightBlock(
			model.getLanguageId(),
			linesOf(model),
			pos.lineNumber,
			{
				cells: () => cellsOf(model),
				outline: () => outlineOf(model),
			},
		);
		const last = model.getLineCount();
		const decos: Monaco.editor.IModelDeltaDecoration[] = [];
		if (start > 1)
			decos.push({
				range: new monaco.Range(1, 1, start - 1, model.getLineMaxColumn(start - 1)),
				options: { inlineClassName: 'anvil-dim' },
			});
		if (end < last)
			decos.push({
				range: new monaco.Range(end + 1, 1, last, model.getLineMaxColumn(last)),
				options: { inlineClassName: 'anvil-dim' },
			});
		dim.set(decos);
	};
	// Typing re-parses once it pauses; the dim ranges track the edit meanwhile. Cursor moves in
	// between wait for that paint instead of parsing each keystroke's version.
	const schedule = (): void => {
		clearTimeout(timer);
		if (enabled) timer = setTimeout(paint, 150);
	};
	const subs = [
		editor.onDidChangeCursorPosition(() => {
			if (timer === undefined) paint();
		}),
		editor.onDidChangeModel(paint),
		editor.onDidChangeModelContent(schedule),
	];
	window.addEventListener('anvil:spotlight', paint);
	paint();
	return {
		dispose() {
			window.removeEventListener('anvil:spotlight', paint);
			clearTimeout(timer);
			for (const s of subs) s.dispose();
			dim.clear();
		},
	};
}
