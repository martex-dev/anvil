import { describe, expect, it } from 'vitest';

import { indentRanges, todoMarkers } from './lens';

describe('indentRanges', () => {
	it('splits tab indentation into one column per level', () => {
		expect(indentRanges('\t\tx = 1', 4)).toEqual([
			[1, 2],
			[2, 3],
		]);
	});

	it('splits space indentation by tab size and ignores a partial level', () => {
		expect(indentRanges('        y', 4)).toEqual([
			[1, 5],
			[5, 9],
		]);
		expect(indentRanges('      z', 4)).toEqual([[1, 5]]);
		expect(indentRanges('x', 4)).toEqual([]);
	});
});

describe('todoMarkers', () => {
	it('finds markers in comments only', () => {
		expect(todoMarkers('x = 1  # TODO: fix units')).toEqual([[10, 15, 'anvil-todo-todo']]);
		expect(todoMarkers('// FIXME later')).toEqual([[4, 9, 'anvil-todo-fix']]);
		expect(todoMarkers('TODO = 3')).toEqual([]);
		expect(todoMarkers('print("NOTE")')).toEqual([]);
	});
});
