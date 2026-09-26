/**
 * `# %%` code cells (the Spyder / VS Code / Jupytext convention): a plain .py file split into
 * runnable chunks. Works on raw lines so it can be tested without Monaco.
 */

export interface Cell {
	/** 1-based line of the `# %%` marker, or 1 for the implicit first cell. */
	start: number;
	/** 1-based last line, inclusive. */
	end: number;
	/** Text after the marker, e.g. "Load data" from `# %% Load data`. */
	title: string;
}

const MARKER = /^\s*#\s*%%(.*)$/;

export function isCellMarker(line: string): boolean {
	return MARKER.test(line);
}

export function findCells(lines: readonly string[]): Cell[] {
	const markers: Array<{ line: number; title: string }> = [];
	lines.forEach((text, i) => {
		const m = MARKER.exec(text);
		if (m)
			markers.push({
				line: i + 1,
				title: (m[1] ?? '').replace(/^\s*\[markdown\]\s*/, '').trim(),
			});
	});
	if (markers.length === 0) return [];
	const cells: Cell[] = [];
	// Code above the first marker is a cell too (imports usually live there).
	const first = markers[0]?.line ?? 1;
	if (first > 1) cells.push({ start: 1, end: first - 1, title: '' });
	markers.forEach((m, i) => {
		const next = markers[i + 1];
		cells.push({ start: m.line, end: next ? next.line - 1 : lines.length, title: m.title });
	});
	return cells;
}

export function cellAt(cells: readonly Cell[], line: number): Cell | null {
	return cells.find((c) => line >= c.start && line <= c.end) ?? null;
}

/** 1-based line where the cell's code starts (the line after its marker, if it has one). */
export function cellCodeLine(lines: readonly string[], cell: Cell): number {
	return isCellMarker(lines[cell.start - 1] ?? '') ? cell.start + 1 : cell.start;
}

/** The cell's code without its marker line and trailing blank lines. */
export function cellCode(lines: readonly string[], cell: Cell): string {
	const body = lines.slice(cellCodeLine(lines, cell) - 1, cell.end);
	while (body.length > 0 && body.at(-1)?.trim() === '') body.pop();
	return body.join('\n');
}

/**
 * Makes a selection safe to paste into a REPL: common indentation removed (a selected method
 * body would otherwise be an IndentationError).
 */
export function dedent(code: string): string {
	const lines = code.replace(/\r\n/g, '\n').split('\n');
	const indents = lines.filter((l) => l.trim()).map((l) => /^[\t ]*/.exec(l)?.[0].length ?? 0);
	const cut = indents.length ? Math.min(...indents) : 0;
	return lines.map((l) => l.slice(Math.min(cut, /^[\t ]*/.exec(l)?.[0].length ?? 0))).join('\n');
}

/**
 * Dedented, trimmed code for the REPL plus how many leading lines the trim dropped, so the
 * caller can keep traceback line numbers pointing at the right line of the source file.
 */
export function replText(code: string): { text: string; skippedLines: number } {
	const dedented = dedent(code);
	const lead = /^\s*/.exec(dedented)?.[0] ?? '';
	const skippedLines = lead.split('\n').length - 1;
	return { text: dedented.trim(), skippedLines };
}
