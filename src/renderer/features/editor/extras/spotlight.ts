import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../../lib/monaco/setup';
import { outlineFor, symbolPath } from '../../outline/outline';
import { cellAt, findCells } from '../../python/cells';

let enabled = false;

export function isSpotlightOn(): boolean {
	return enabled;
}

export function toggleSpotlight(): boolean {
	enabled = !enabled;
	window.dispatchEvent(new CustomEvent('anvil:spotlight'));
	return enabled;
}

/**
 * The block to keep lit around a line: its `# %%` cell, else the innermost function/class,
 * else the paragraph (run of non-blank lines).
 */
export function spotlightBlock(
	language: string,
	lines: readonly string[],
	line: number,
): { start: number; end: number } {
	const cell = language === 'python' ? cellAt(findCells(lines), line) : null;
	if (cell) return { start: cell.start, end: cell.end };
	const symbol = symbolPath(outlineFor(language, lines), line).at(-1);
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
	const paint = (): void => {
		const model = editor.getModel();
		const pos = editor.getPosition();
		if (!enabled || !model || !pos) return dim.clear();
		const { start, end } = spotlightBlock(
			model.getLanguageId(),
			model.getLinesContent(),
			pos.lineNumber,
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
	const subs = [
		editor.onDidChangeCursorPosition(paint),
		editor.onDidChangeModel(paint),
		editor.onDidChangeModelContent(paint),
	];
	window.addEventListener('anvil:spotlight', paint);
	paint();
	return {
		dispose() {
			window.removeEventListener('anvil:spotlight', paint);
			for (const s of subs) s.dispose();
			dim.clear();
		},
	};
}
