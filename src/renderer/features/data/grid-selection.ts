export interface CellPos {
	row: number;
	col: number;
}

/** Anchor stays put while shift-extending; focus is the cell that moves. */
export interface GridSelection {
	anchor: CellPos;
	focus: CellPos;
}

export interface CellRange {
	top: number;
	left: number;
	bottom: number;
	right: number;
}

export function selectionRange(selection: GridSelection): CellRange {
	const { anchor, focus } = selection;
	return {
		top: Math.min(anchor.row, focus.row),
		bottom: Math.max(anchor.row, focus.row),
		left: Math.min(anchor.col, focus.col),
		right: Math.max(anchor.col, focus.col),
	};
}

export function rangeSize(range: CellRange): { rows: number; cols: number } {
	return { rows: range.bottom - range.top + 1, cols: range.right - range.left + 1 };
}

export interface GridBounds {
	rows: number;
	cols: number;
	/** Rows per PageUp/PageDown. */
	pageRows: number;
}

export interface NavKey {
	key: string;
	shiftKey: boolean;
	ctrlKey: boolean;
}

function clamp(value: number, max: number): number {
	return Math.min(Math.max(0, value), Math.max(0, max));
}

/**
 * Spreadsheet-style keyboard navigation. Returns null for keys it doesn't handle so the caller
 * can let them through. Shift extends the range from the anchor instead of moving it.
 */
export function moveSelection(
	selection: GridSelection | null,
	event: NavKey,
	bounds: GridBounds,
): GridSelection | null {
	if (bounds.rows === 0 || bounds.cols === 0) return null;
	const from = selection?.focus ?? { row: 0, col: 0 };
	const lastRow = bounds.rows - 1;
	const lastCol = bounds.cols - 1;
	let { row, col } = from;
	switch (event.key) {
		case 'ArrowUp':
			row = event.ctrlKey ? 0 : row - 1;
			break;
		case 'ArrowDown':
			row = event.ctrlKey ? lastRow : row + 1;
			break;
		case 'ArrowLeft':
			col = event.ctrlKey ? 0 : col - 1;
			break;
		case 'ArrowRight':
			col = event.ctrlKey ? lastCol : col + 1;
			break;
		case 'PageUp':
			row -= bounds.pageRows;
			break;
		case 'PageDown':
			row += bounds.pageRows;
			break;
		case 'Home':
			col = 0;
			if (event.ctrlKey) row = 0;
			break;
		case 'End':
			col = lastCol;
			if (event.ctrlKey) row = lastRow;
			break;
		default:
			return null;
	}
	const focus = { row: clamp(row, lastRow), col: clamp(col, lastCol) };
	if (event.shiftKey && selection) return { anchor: selection.anchor, focus };
	return { anchor: focus, focus };
}

export function rangeContains(range: CellRange, pos: CellPos): boolean {
	return (
		pos.row >= range.top &&
		pos.row <= range.bottom &&
		pos.col >= range.left &&
		pos.col <= range.right
	);
}

/**
 * A row-number click selects the whole row, like a spreadsheet. With `extendFrom` (Shift, or a
 * drag down the gutter) the rows between the existing anchor and this one are selected.
 */
export function rowSelection(
	row: number,
	cols: number,
	extendFrom: GridSelection | null = null,
): GridSelection {
	const lastCol = Math.max(0, cols - 1);
	return {
		anchor: { row: extendFrom ? extendFrom.anchor.row : row, col: 0 },
		focus: { row, col: lastCol },
	};
}

/** How a copy is written: tab-separated without a header unless asked otherwise. */
export interface CopyOptions {
	csv?: boolean;
	header?: boolean;
}
