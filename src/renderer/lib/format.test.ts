import { describe, expect, it } from 'vitest';

import { formatAge, formatPercent, formatPrice, formatUsdCompact, shortAddress } from './format';

describe('formatPrice', () => {
	it.each([
		[67432.12, '67,432.12'],
		[142.5, '142.5'],
		[1.23456, '1.2346'],
		[0.5, '0.5'],
		[0.004312, '0.004312'],
		[0.0001234, '0.0₃1234'],
		[0.0000001234, '0.0₆1234'],
		[0.00000000005, '0.0₁₀5'],
		[0, '0'],
		[null, '—'],
		[Number.NaN, '—'],
	])('%s → %s', (value, expected) => {
		expect(formatPrice(value)).toBe(expected);
	});
});

describe('formatUsdCompact', () => {
	it.each([
		[1_234_567_890, '$1.2B'],
		[456_700_000, '$457M'],
		[12_345, '$12.3K'],
		[999, '$999'],
		[null, '—'],
	])('%s → %s', (value, expected) => {
		expect(formatUsdCompact(value)).toBe(expected);
	});
});

describe('formatPercent / formatAge / shortAddress', () => {
	it('formats', () => {
		expect(formatPercent(12.345)).toBe('+12.3%');
		expect(formatPercent(-0.44)).toBe('-0.4%');
		expect(formatPercent(1234)).toBe('+1234%');
		expect(formatAge(0, 5 * 60_000)).toBe('5m');
		expect(formatAge(0, 3 * 86_400_000)).toBe('3d');
		expect(shortAddress('So11111111111111111111111111111111111111112')).toBe('So11…1112');
	});
});
