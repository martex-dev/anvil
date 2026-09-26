import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../../lib/monaco/setup';
import { cellAt, findCells } from '../../python/cells';

/**
 * Draws `# %%` cells in Python files: a hairline above each marker, a ▸ glyph to run it, and a
 * faint wash over the cell the cursor is in.
 */
export function attachCells(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
	runCellAt: (line: number) => void,
): Monaco.IDisposable {
	const markers = editor.createDecorationsCollection();
	const active = editor.createDecorationsCollection();
	let timer: ReturnType<typeof setTimeout> | null = null;

	const cellsOf = (model: Monaco.editor.ITextModel): ReturnType<typeof findCells> =>
		model.getLanguageId() === 'python' ? findCells(model.getLinesContent()) : [];

	const paintActive = (): void => {
		const model = editor.getModel();
		const pos = editor.getPosition();
		if (!model || !pos) return active.clear();
		const cell = cellAt(cellsOf(model), pos.lineNumber);
		active.set(
			cell
				? [
						{
							range: new monaco.Range(cell.start, 1, cell.end, 1),
							options: { isWholeLine: true, className: 'anvil-cell-active' },
						},
					]
				: [],
		);
	};
	const paint = (): void => {
		const model = editor.getModel();
		if (!model) {
			markers.clear();
			active.clear();
			return;
		}
		markers.set(
			cellsOf(model)
				.filter((c) => /^\s*#\s*%%/.test(model.getLineContent(c.start)))
				.map((c) => ({
					range: new monaco.Range(c.start, 1, c.start, 1),
					options: {
						isWholeLine: true,
						className: 'anvil-cell-line',
						// Own lanes for the run arrow and bookmarks: on a `# %%` line with a bookmark
						// Monaco widens the margin instead of drawing one glyph over the other.
						glyphMargin: { position: monaco.editor.GlyphMarginLane.Left },
						glyphMarginClassName: 'anvil-cell-glyph',
						glyphMarginHoverMessage: {
							value: `Run cell${c.title ? ` "${c.title}"` : ''} (Ctrl+Enter)`,
						},
					},
				})),
		);
		paintActive();
	};
	const schedule = (): void => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(paint, 150);
	};

	const subs = [
		editor.onDidChangeModel(paint),
		editor.onDidChangeModelLanguage(paint),
		editor.onDidChangeModelContent(schedule),
		editor.onDidChangeCursorPosition(paintActive),
		editor.onMouseDown((e) => {
			if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
			const line = e.target.position?.lineNumber;
			const model = editor.getModel();
			if (!line || !model) return;
			if (/^\s*#\s*%%/.test(model.getLineContent(line))) runCellAt(line);
		}),
	];
	paint();
	return {
		dispose() {
			if (timer) clearTimeout(timer);
			for (const s of subs) s.dispose();
			markers.clear();
			active.clear();
		},
	};
}
