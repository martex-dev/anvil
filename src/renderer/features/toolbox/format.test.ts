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

	it('accepts plain decimals and exponents', () => {
		expect(parseNumber('-1.5')).toBe(-1.5);
		expect(parseNumber('.5')).toBe(0.5);
		expect(parseNumber('5.')).toBe(5);
		expect(parseNumber('+1E-3')).toBe(0.001);
		expect(parseNumber('1,234,567')).toBe(1234567);
		expect(parseNumber('10 000')).toBe(10000);
	});

	it('returns NaN for garbage so validation can reject it', () => {
		expect(parseNumber('abc')).toBeNaN();
	});

	it('rejects a decimal comma instead of reading it as a larger number', () => {
		expect(parseNumber('0,5')).toBeNaN();
		expect(parseNumber('1,5')).toBeNaN();
		expect(parseNumber('1,50')).toBeNaN();
		expect(parseNumber('1,000,00')).toBeNaN();
		expect(parseNumber('1,000.5,0')).toBeNaN();
	});

	it('rejects non-decimal forms Number() would accept', () => {
		expect(parseNumber('0x10')).toBeNaN();
		expect(parseNumber('0b1')).toBeNaN();
		expect(parseNumber('Infinity')).toBeNaN();
		expect(parseNumber('.')).toBeNaN();
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
