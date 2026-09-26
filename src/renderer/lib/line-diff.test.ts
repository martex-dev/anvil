import { describe, expect, it } from 'vitest';

import { diffLines } from './line-diff';

const lines = (...xs: string[]): string => xs.join('\n');

describe('diffLines', () => {
	it('is empty for identical text', () => {
		expect(diffLines('a\nb', 'a\nb')).toEqual([]);
	});

	it('finds added lines', () => {
		expect(diffLines(lines('a', 'b'), lines('a', 'x', 'y', 'b'))).toEqual([
			{ kind: 'added', start: 2, end: 3 },
		]);
	});

	it('finds modified lines', () => {
		expect(diffLines(lines('a', 'b', 'c'), lines('a', 'B', 'c'))).toEqual([
			{ kind: 'modified', start: 2, end: 2 },
		]);
	});

	it('finds deleted lines as a marker after the previous line', () => {
		expect(diffLines(lines('a', 'b', 'c'), lines('a', 'c'))).toEqual([
			{ kind: 'deleted', start: 2, end: 1 },
		]);
		expect(diffLines(lines('a', 'b'), lines('b'))).toEqual([
			{ kind: 'deleted', start: 1, end: 0 },
		]);
	});

	it('handles several hunks in one file', () => {
		const old = lines('1', '2', '3', '4', '5', '6', '7');
		const now = lines('1', 'two', '3', '4', '4.5', '5', '7');
		expect(diffLines(old, now)).toEqual([
			{ kind: 'modified', start: 2, end: 2 },
			{ kind: 'added', start: 5, end: 5 },
			{ kind: 'deleted', start: 7, end: 6 },
		]);
	});

	it('treats CRLF and LF alike and gives up past the cost limit', () => {
		expect(diffLines('a\r\nb', 'a\nb')).toEqual([]);
		const big = Array.from({ length: 50 }, (_, i) => `x${i}`).join('\n');
		const other = Array.from({ length: 50 }, (_, i) => `y${i}`).join('\n');
		expect(diffLines(big, other, 10)).toBeNull();
	});
});
