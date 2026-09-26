import { describe, expect, it } from 'vitest';

import { cellAt, cellCode, cellCodeLine, dedent, findCells, needsStaging, replText } from './cells';

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

	it('knows the source line each cell body starts at', () => {
		const cells = findCells(src);
		expect(cells.map((c) => cellCodeLine(src, c))).toEqual([1, 4, 7, 9]);
	});

	it('counts leading blank lines dropped before sending to the REPL', () => {
		expect(replText('\n\n  x = 1\n  y = 2\n')).toEqual({
			text: 'x = 1\ny = 2',
			skippedLines: 2,
		});
		expect(replText('x = 1')).toEqual({ text: 'x = 1', skippedLines: 0 });
	});
});

describe('needsStaging', () => {
	it('stages multi-line code and one-line compound statements', () => {
		expect(needsStaging('a = 1\nb = 2')).toBe(true);
		expect(needsStaging('for i in range(3): print(i)')).toBe(true);
		expect(needsStaging('with open(p) as f: data = f.read()')).toBe(true);
		expect(needsStaging('if x: y()')).toBe(true);
		expect(needsStaging('async def f(): pass')).toBe(true);
		expect(needsStaging('@cache')).toBe(true);
		expect(needsStaging('while True:')).toBe(true);
	});

	it('types simple statements and expressions as they are', () => {
		expect(needsStaging('df.describe()')).toBe(false);
		expect(needsStaging('x = {"a": 1}')).toBe(false);
		expect(needsStaging('format_x = 3')).toBe(false);
		expect(needsStaging('iffy = 2')).toBe(false);
	});
});
