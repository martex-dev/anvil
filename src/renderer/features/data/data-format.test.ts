import { describe, expect, it } from 'vitest';

import {
	columnOffsets,
	computeWindow,
	fileName,
	formatCount,
	formatStat,
	formatStatText,
	initialColumnWidth,
	isTrueText,
	MAX_SCROLL_PX,
	nextSort,
	pagesForRange,
	profileScope,
	ROW_HEIGHT,
	rowCountLabel,
	scrollTopForRow,
	toDelimited,
	typeTag,
	visibleColumns,
	visibleRowRange,
} from './data-format';

describe('labels and numbers', () => {
	it('tags column types', () => {
		expect(typeTag('int')).toBe('INT');
		expect(typeTag('float')).toBe('FLT');
		expect(typeTag('string')).toBe('STR');
	});

	it('formats counts and stats', () => {
		expect(formatCount(1234567)).toBe('1,234,567');
		expect(formatStat(null)).toBe('—');
		expect(formatStat(Number.NaN)).toBe('—');
		expect(formatStat(0)).toBe('0');
		expect(formatStat(1234.56789)).toBe('1,234.57');
		expect(formatStat(-0.5)).toBe('-0.5');
		expect(formatStat(0.00001234)).toBe('1.234e-5');
		expect(formatStatText('65010', true)).toBe('65,010');
		expect(formatStatText('2024-01-01', false)).toBe('2024-01-01');
		expect(formatStatText(null, true)).toBe('—');
	});

	it('extracts file names from either separator', () => {
		expect(fileName('C:\\data\\prices.parquet')).toBe('prices.parquet');
		expect(fileName('data/trades.csv')).toBe('trades.csv');
	});

	it('sizes columns from header and type', () => {
		expect(initialColumnWidth({ name: 'px', type: 'float' })).toBe(96);
		expect(initialColumnWidth({ name: 'ts', type: 'date' })).toBe(150);
		expect(initialColumnWidth({ name: 'x'.repeat(200), type: 'string' })).toBe(320);
	});
});

describe('nextSort', () => {
	it('cycles asc → desc → none, and restarts on another column', () => {
		const asc = nextSort(null, 2);
		expect(asc).toEqual({ column: 2, desc: false });
		const desc = nextSort(asc, 2);
		expect(desc).toEqual({ column: 2, desc: true });
		expect(nextSort(desc, 2)).toBeNull();
		expect(nextSort(desc, 0)).toEqual({ column: 0, desc: false });
	});
});

describe('toDelimited', () => {
	it('quotes only when needed and blanks nulls', () => {
		const rows = [
			['a', 'b,c', null],
			['say "hi"', 'line\nbreak', '1.5'],
		];
		expect(toDelimited(rows, ',')).toBe('a,"b,c",\r\n"say ""hi""","line\nbreak",1.5');
		expect(toDelimited([['b,c', 'x\ty']], '\t')).toBe('b,c\t"x\ty"');
	});
});

describe('virtual window', () => {
	it('renders only visible rows plus overscan', () => {
		const w = computeWindow(ROW_HEIGHT * 100, ROW_HEIGHT * 20, 1_000, 5);
		expect(w).toMatchObject({ start: 95, end: 125, top: 95 * ROW_HEIGHT, ratio: 1 });
		expect(w.height).toBe(1_000 * ROW_HEIGHT);
	});

	it('clamps at the edges', () => {
		expect(computeWindow(0, 480, 10, 5)).toMatchObject({ start: 0, end: 10 });
		expect(computeWindow(0, 480, 0, 5)).toMatchObject({ start: 0, end: 0, height: 0 });
	});

	it('scales very tall tables so the spacer stays under the browser limit', () => {
		const rows = 5_000_000;
		const viewport = 480;
		const bottom = computeWindow(MAX_SCROLL_PX, viewport, rows, 0);
		expect(bottom.height).toBe(MAX_SCROLL_PX);
		expect(bottom.ratio).toBeGreaterThan(1);
		expect(bottom.end).toBe(rows);
		// Row `start` must sit at its natural offset from the viewport top.
		expect(bottom.top).toBeLessThanOrEqual(MAX_SCROLL_PX - viewport);
	});

	it('scrolls just enough to reveal a row', () => {
		const viewport = ROW_HEIGHT * 10;
		expect(scrollTopForRow(3, 0, viewport, 1_000)).toBe(0);
		expect(scrollTopForRow(15, 0, viewport, 1_000)).toBe(6 * ROW_HEIGHT);
		expect(scrollTopForRow(2, 10 * ROW_HEIGHT, viewport, 1_000)).toBe(2 * ROW_HEIGHT);
	});

	it('finds visible columns and pages', () => {
		const offsets = columnOffsets([100, 100, 100, 100]);
		expect(offsets).toEqual([0, 100, 200, 300, 400]);
		expect(visibleColumns(offsets, 150, 250)).toEqual({ start: 1, end: 3 });
		expect(visibleColumns(offsets, -50, 1_000)).toEqual({ start: 0, end: 4 });
		expect(pagesForRange(0, 500)).toEqual([0]);
		expect(pagesForRange(450, 520)).toEqual([0, 1]);
		expect(pagesForRange(10, 10)).toEqual([]);
	});
});

describe('profileScope', () => {
	it('says when only the loaded head of the file was profiled', () => {
		expect(profileScope(false, 10)).toBe('Computed over the whole file, ignoring the filter.');
		expect(profileScope(true, 250000)).toBe(
			'Computed over the first 250,000 rows (all that was loaded), ignoring the filter.',
		);
	});
});

describe('rowCountLabel', () => {
	it('says how many rows a filter kept', () => {
		expect(rowCountLabel(12, 1204331)).toBe('12 of 1,204,331 rows');
		expect(rowCountLabel(1204331, 1204331)).toBe('1,204,331 rows');
	});
});

describe('visibleRowRange', () => {
	it('spans the rows on screen, including a partly shown last one', () => {
		expect(visibleRowRange(495, 24 * 35 + 10, 10_000)).toEqual({ top: 495, bottom: 530 });
	});

	it('stops at the last row', () => {
		expect(visibleRowRange(8, 24 * 20, 10)).toEqual({ top: 8, bottom: 9 });
		expect(visibleRowRange(0, 0, 1)).toEqual({ top: 0, bottom: 0 });
	});
});

describe('isTrueText', () => {
	it('matches true in any case, as the bool type check does', () => {
		expect(['true', 'True', 'TRUE'].map(isTrueText)).toEqual([true, true, true]);
		expect(['false', 'False', 'yes'].map(isTrueText)).toEqual([false, false, false]);
	});
});
