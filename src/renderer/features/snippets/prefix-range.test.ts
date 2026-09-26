import { describe, expect, it } from 'vitest';

import { prefixStartColumn } from './prefix-range';

describe('prefixStartColumn', () => {
	it('spans a hyphenated prefix before the cursor', () => {
		// 'x = resample-p' with the cursor at the end (column 15).
		expect(prefixStartColumn('x = resample-p', 15)).toBe(5);
	});

	it('stops at whitespace and punctuation', () => {
		expect(prefixStartColumn('    pytest-approx', 18)).toBe(5);
		expect(prefixStartColumn('f(resample-pl', 14)).toBe(3);
	});

	it('only looks left of the cursor', () => {
		expect(prefixStartColumn('resample-pd tail', 12)).toBe(1);
	});

	it('returns the cursor column when nothing prefix-like precedes it', () => {
		expect(prefixStartColumn('x = ', 5)).toBe(5);
		expect(prefixStartColumn('', 1)).toBe(1);
	});
});
