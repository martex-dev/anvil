import { type MouseEvent, useRef } from 'react';

import type { MenuItem } from '../../ui/ContextMenu';
import {
	type CellPos,
	type CellRange,
	type CopyOptions,
	type GridSelection,
	rangeContains,
	rowSelection,
	selectionRange,
} from './grid-selection';

function cellAt(event: MouseEvent): CellPos | null {
	const target = event.target instanceof HTMLElement ? event.target.closest('[data-col]') : null;
	if (!(target instanceof HTMLElement)) return null;
	const row = Number(target.dataset.row);
	const col = Number(target.dataset.col);
	return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

/** The row whose number (gutter) cell was hit, or null. */
function gutterRowAt(event: MouseEvent): number | null {
	const target =
		event.target instanceof HTMLElement ? event.target.closest('[data-gutter]') : null;
	if (!(target instanceof HTMLElement)) return null;
	const row = Number(target.dataset.gutter);
	return Number.isInteger(row) ? row : null;
}

/** Any row under the pointer, from a cell or its row number; used while dragging rows. */
function rowAt(event: MouseEvent): number | null {
	return gutterRowAt(event) ?? cellAt(event)?.row ?? null;
}

interface GridMouseOptions {
	selection: GridSelection | null;
	columnCount: number;
	onSelectionChange: (selection: GridSelection | null) => void;
	focusGrid: () => void;
}

interface GridMouseHandlers {
	onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
	onMouseMove: (event: MouseEvent<HTMLDivElement>) => void;
	onMouseUp: () => void;
}

/**
 * Spreadsheet-style pointer selection: click and drag over cells, click or drag the row numbers
 * for whole rows, Shift+click to extend, and right-click to select before the context menu.
 */
export function useGridMouse({
	selection,
	columnCount,
	onSelectionChange,
	focusGrid,
}: GridMouseOptions): GridMouseHandlers {
	/** What a left-button drag is extending: a cell range, or whole rows from the gutter. */
	const dragging = useRef<'cells' | 'rows' | null>(null);
	const range = selection ? selectionRange(selection) : null;

	const onMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
		const gutterRow = gutterRowAt(event);
		const pos = cellAt(event);
		if (event.button === 2) {
			// Right-click outside the selection selects what was clicked first, so the context
			// menu acts on it (as in a spreadsheet).
			if (pos && !(range && rangeContains(range, pos)))
				onSelectionChange({ anchor: pos, focus: pos });
			else if (
				gutterRow !== null &&
				!(range && rangeContains(range, { row: gutterRow, col: 0 }))
			)
				onSelectionChange(rowSelection(gutterRow, columnCount));
			return;
		}
		if (event.button !== 0) return;
		const extend = event.shiftKey && selection ? selection : null;
		if (extend) {
			// Stops the browser from starting a text selection between the two clicks.
			event.preventDefault();
			focusGrid();
		}
		if (gutterRow !== null) {
			dragging.current = 'rows';
			onSelectionChange(rowSelection(gutterRow, columnCount, extend));
			return;
		}
		if (!pos) return;
		dragging.current = 'cells';
		onSelectionChange(
			extend ? { anchor: extend.anchor, focus: pos } : { anchor: pos, focus: pos },
		);
	};

	const onMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
		if (!dragging.current) return;
		if ((event.buttons & 1) === 0) {
			dragging.current = null;
			return;
		}
		if (!selection) return;
		if (dragging.current === 'rows') {
			const row = rowAt(event);
			if (row === null || row === selection.focus.row) return;
			onSelectionChange(rowSelection(row, columnCount, selection));
			return;
		}
		const pos = cellAt(event);
		if (!pos) return;
		if (pos.row === selection.focus.row && pos.col === selection.focus.col) return;
		onSelectionChange({ anchor: selection.anchor, focus: pos });
	};

	return { onMouseDown, onMouseMove, onMouseUp: () => (dragging.current = null) };
}

/** The grid's right-click menu. */
export function gridMenuItems(
	range: CellRange | null,
	totalRows: number,
	columnCount: number,
	onCopy: (range: CellRange, options?: CopyOptions) => void,
	onSelectionChange: (selection: GridSelection | null) => void,
): Array<MenuItem | 'separator'> {
	const copy = (options?: CopyOptions): void => {
		if (range) onCopy(range, options);
	};
	return [
		{ label: 'Copy', shortcut: 'Ctrl+C', disabled: !range, onSelect: () => copy() },
		{ label: 'Copy with headers', disabled: !range, onSelect: () => copy({ header: true }) },
		{
			label: 'Copy as CSV',
			disabled: !range,
			onSelect: () => copy({ csv: true, header: true }),
		},
		'separator',
		{
			label: 'Select all',
			shortcut: 'Ctrl+A',
			onSelect: () =>
				onSelectionChange({
					anchor: { row: 0, col: 0 },
					focus: { row: totalRows - 1, col: columnCount - 1 },
				}),
		},
	];
}
