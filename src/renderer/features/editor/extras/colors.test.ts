import { describe, expect, it } from 'vitest';

import { findColors, formatColor, parseColor } from './colors';

describe('color literals', () => {
	it('finds hex, rgb and hsl colors with their offsets', () => {
		const found = findColors(
			"UP = '#3dffa8'; bg = 'rgba(8, 11, 18, 0.9)'; x = hsl(190 90% 55%)",
		);
		expect(found.map((f) => f.format)).toEqual(['hex', 'rgb', 'hsl']);
		expect(found[0]).toMatchObject({ start: 6, end: 13 });
	});

	it('parses short hex and alpha', () => {
		expect(parseColor('#fff')?.color).toEqual({ red: 1, green: 1, blue: 1, alpha: 1 });
		expect(parseColor('#00000080')?.color.alpha).toBeCloseTo(0.5, 2);
		expect(parseColor('rgb(255 0 0 / 50%)')?.color).toMatchObject({
			red: 1,
			green: 0,
			alpha: 0.5,
		});
	});

	it('round-trips through each format', () => {
		const c = parseColor('#22e5ff')?.color;
		expect(c).toBeDefined();
		if (!c) return;
		expect(formatColor(c, 'hex')).toBe('#22e5ff');
		expect(formatColor(c, 'rgb')).toBe('rgb(34, 229, 255)');
		expect(formatColor(parseColor('hsl(120, 100%, 50%)')?.color ?? c, 'hex')).toBe('#00ff00');
	});

	it('ignores things that only look like colors', () => {
		expect(findColors('issue #12345 and #abcdefg')).toEqual([]);
	});
});
