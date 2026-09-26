import { describe, expect, it } from 'vitest';

import {
	activeCellId,
	type GridSelection,
	moveSelection,
	rangeContains,
	rangeSize,
	rowSelection,
	selectionRange,
} from './grid-selection';

const bounds = { rows: 100, cols: 5, pageRows: 10 };
const at = (row: number, col: number): GridSelection => ({
	anchor: { row, col },
	focus: { row, col },
});
const key = (k: string, mods: { shiftKey?: boolean; ctrlKey?: boolean } = {}) => ({
	key: k,
	shiftKey: mods.shiftKey ?? false,
	ctrlKey: mods.ctrlKey ?? false,
});

describe('selectionRange', () => {
	it('normalizes any drag direction', () => {
		const range = selectionRange({ anchor: { row: 9, col: 3 }, focus: { row: 2, col: 1 } });
		expect(range).toEqual({ top: 2, bottom: 9, left: 1, right: 3 });
		expect(rangeSize(range)).toEqual({ rows: 8, cols: 3 });
	});
});

describe('moveSelection', () => {
	it('moves with arrows and clamps to the table', () => {
		expect(moveSelection(at(0, 0), key('ArrowUp'), bounds)).toEqual(at(0, 0));
		expect(moveSelection(at(0, 0), key('ArrowDown'), bounds)).toEqual(at(1, 0));
		expect(moveSelection(at(0, 4), key('ArrowRight'), bounds)).toEqual(at(0, 4));
	});

	it('starts at the first cell when nothing is selected', () => {
		expect(moveSelection(null, key('ArrowRight'), bounds)).toEqual(at(0, 1));
	});

	it('pages, jumps and extends with shift', () => {
		expect(moveSelection(at(5, 2), key('PageDown'), bounds)).toEqual(at(15, 2));
		expect(moveSelection(at(5, 2), key('PageUp'), bounds)).toEqual(at(0, 2));
		expect(moveSelection(at(5, 2), key('End'), bounds)).toEqual(at(5, 4));
		expect(moveSelection(at(5, 2), key('End', { ctrlKey: true }), bounds)).toEqual(at(99, 4));
		expect(moveSelection(at(5, 2), key('Home', { ctrlKey: true }), bounds)).toEqual(at(0, 0));
		expect(moveSelection(at(5, 2), key('ArrowDown', { shiftKey: true }), bounds)).toEqual({
			anchor: { row: 5, col: 2 },
			focus: { row: 6, col: 2 },
		});
	});

	it('ignores other keys and empty tables', () => {
		expect(moveSelection(at(1, 1), key('a'), bounds)).toBeNull();
		expect(moveSelection(null, key('ArrowDown'), { rows: 0, cols: 3, pageRows: 5 })).toBeNull();
	});
});

describe('rowSelection', () => {
	it('selects every column of the clicked row', () => {
		expect(rowSelection(7, 5)).toEqual({
			anchor: { row: 7, col: 0 },
			focus: { row: 7, col: 4 },
		});
	});

	it('extends from the existing anchor row', () => {
		const range = selectionRange(rowSelection(3, 5, at(9, 2)));
		expect(range).toEqual({ top: 3, bottom: 9, left: 0, right: 4 });
	});
});

describe('rangeContains', () => {
	it('includes the edges and nothing outside', () => {
		const range = { top: 2, bottom: 4, left: 1, right: 3 };
		expect(rangeContains(range, { row: 2, col: 3 })).toBe(true);
		expect(rangeContains(range, { row: 5, col: 3 })).toBe(false);
		expect(rangeContains(range, { row: 3, col: 0 })).toBe(false);
	});
});

describe('activeCellId', () => {
	const rows = { start: 10, end: 40 };
	const cols = { start: 0, end: 3 };

	it('names the focus cell while it is rendered', () => {
		expect(activeCellId('g', { row: 12, col: 2 }, rows, cols)).toBe('g-r12-c2');
	});

	it('is undefined without a focus or when the cell is virtualized away', () => {
		expect(activeCellId('g', undefined, rows, cols)).toBeUndefined();
		expect(activeCellId('g', { row: 40, col: 0 }, rows, cols)).toBeUndefined();
		expect(activeCellId('g', { row: 12, col: 3 }, rows, cols)).toBeUndefined();
	});
});
