import { describe, expect, it } from 'vitest';

import { cellAt, cellCode, dedent, findCells } from './cells';

const src = [
	'import polars as pl',
	'',
	'# %% Load',
	'df = pl.read_csv("x.csv")',
	'',
	'# %% [markdown] Notes',
	'# text',
	'# %%',
	'df.describe()',
	'',
	'',
];

describe('cells', () => {
	it('splits on # %% markers with an implicit first cell', () => {
		const cells = findCells(src);
		expect(cells.map((c) => [c.start, c.end, c.title])).toEqual([
			[1, 2, ''],
			[3, 5, 'Load'],
			[6, 7, 'Notes'],
			[8, 11, ''],
		]);
	});

	it('has no cells in a plain script', () => {
		expect(findCells(['x = 1', 'print(x)'])).toEqual([]);
	});

	it('finds the cell under the cursor and extracts its code', () => {
		const cells = findCells(src);
		const code = (line: number): string => {
			const cell = cellAt(cells, line);
			return cell ? cellCode(src, cell) : '<none>';
		};
		expect(code(4)).toBe('df = pl.read_csv("x.csv")');
		expect(code(9)).toBe('df.describe()');
		expect(code(1)).toBe('import polars as pl');
	});

	it('dedents a selection from inside a function', () => {
		expect(dedent('\t\tx = 1\n\t\tif x:\n\t\t\tprint(x)')).toBe('x = 1\nif x:\n\tprint(x)');
		expect(dedent('    a\n\n    b')).toBe('a\n\nb');
	});
});
