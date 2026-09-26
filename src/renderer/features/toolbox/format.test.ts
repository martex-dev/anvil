import { describe, expect, it } from 'vitest';

import { attempt, formatGrouped, formatPlain, parseNumber } from './format';

describe('attempt', () => {
	it('wraps a value', () => {
		expect(attempt(() => 42)).toEqual({ ok: true, value: 42 });
	});

	it('captures a thrown error message', () => {
		expect(
			attempt(() => {
				throw new Error('Equity must be a positive number');
			}),
		).toEqual({ ok: false, error: 'Equity must be a positive number' });
	});

	it('stringifies non-Error throws', () => {
		expect(
			attempt(() => {
				throw 'boom';
			}),
		).toEqual({ ok: false, error: 'boom' });
	});
});

describe('parseNumber', () => {
	it('returns null for blank input', () => {
		expect(parseNumber('')).toBeNull();
		expect(parseNumber('   ')).toBeNull();
	});

	it('ignores pasted separators', () => {
		expect(parseNumber('10,000.5')).toBe(10000.5);
		expect(parseNumber('1_000')).toBe(1000);
		expect(parseNumber(' 2e3 ')).toBe(2000);
	});

	it('returns NaN for garbage so validation can reject it', () => {
		expect(parseNumber('abc')).toBeNaN();
	});
});

describe('formatPlain', () => {
	it('trims trailing zeros and never groups', () => {
		expect(formatPlain(1234567.5)).toBe('1234567.5');
		expect(formatPlain(0.1 + 0.2)).toBe('0.3');
		expect(formatPlain(2)).toBe('2');
	});

	it('respects the fraction limit', () => {
		expect(formatPlain(1 / 3, 4)).toBe('0.3333');
	});

	it('keeps significant digits for tiny non-zero values instead of rounding to 0', () => {
		expect(formatPlain(1.23456789e-9)).toBe('0.00000000123457');
		expect(formatPlain(-4e-10)).toBe('-0.0000000004');
		expect(formatPlain(0.001, 2)).toBe('0.001');
		expect(formatPlain(0)).toBe('0');
	});

	it('passes non-finite values through', () => {
		expect(formatPlain(Number.POSITIVE_INFINITY)).toBe('Infinity');
	});
});

describe('formatGrouped', () => {
	it('adds thousands separators', () => {
		expect(formatGrouped(1234567.891)).toBe('1,234,567.89');
	});
});
