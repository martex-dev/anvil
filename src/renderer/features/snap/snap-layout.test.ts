import { describe, expect, it } from 'vitest';

import {
	clipRuns,
	dedent,
	ellipsize,
	expandTabs,
	exportScale,
	gradientLine,
	type LayoutInput,
	layoutSnap,
	lineNumberDigits,
	PADDING_PX,
	prepareSnapCode,
	snapFileName,
	trimBlankEdges,
	withAlpha,
} from './snap-layout';

describe('expandTabs', () => {
	it('expands to the next tab stop, not a fixed width', () => {
		expect(expandTabs('\tx', 4)).toBe('    x');
		expect(expandTabs('ab\tc', 4)).toBe('ab  c');
		expect(expandTabs('abcd\te', 4)).toBe('abcd    e');
		expect(expandTabs('a\t\tb', 2)).toBe('a   b');
	});

	it('leaves tab-free lines alone and guards bad sizes', () => {
		expect(expandTabs('no tabs', 4)).toBe('no tabs');
		expect(expandTabs('\tx', 0)).toBe(' x');
	});
});

describe('dedent', () => {
	it('removes the shared indentation', () => {
		expect(dedent(['    if x:', '        y()', '    z()'])).toEqual([
			'if x:',
			'    y()',
			'z()',
		]);
	});

	it('ignores blank lines when finding the common indent and empties them', () => {
		expect(dedent(['  a', '', '     ', '    b'])).toEqual(['a', '', '', '  b']);
	});

	it('does not treat a tab and a space as the same indent', () => {
		expect(dedent(['\ta', ' b'])).toEqual(['\ta', ' b']);
	});

	it('handles unindented and empty input', () => {
		expect(dedent(['a', '  b'])).toEqual(['a', '  b']);
		expect(dedent([])).toEqual([]);
	});
});

describe('trimBlankEdges', () => {
	it('drops blank edge lines and shifts the start line', () => {
		expect(trimBlankEdges(['', '  ', 'a', '', 'b', ''], 10)).toEqual({
			lines: ['a', '', 'b'],
			startLine: 12,
		});
	});

	it('returns nothing for all-blank input', () => {
		expect(trimBlankEdges(['', ' '], 1).lines).toEqual([]);
	});
});

describe('prepareSnapCode', () => {
	it('expands tabs, trims trailing space and blank edges, then dedents', () => {
		const out = prepareSnapCode(['', '\tdef f():  ', '\t\treturn 1', ''], 5, 4);
		expect(out).toEqual({ code: 'def f():\n    return 1', startLine: 6 });
	});
});

describe('lineNumberDigits', () => {
	it('sizes the gutter for the last line number shown', () => {
		expect(lineNumberDigits(1, 9)).toBe(1);
		expect(lineNumberDigits(1, 10)).toBe(2);
		expect(lineNumberDigits(95, 10)).toBe(3);
	});
});

const base: LayoutInput = {
	lineCount: 10,
	contentWidth: 400,
	charWidth: 8,
	lineHeight: 22,
	padding: 'm',
	chrome: 'mac',
	lineNumbers: false,
	startLine: 1,
	watermark: 'none',
};

describe('layoutSnap', () => {
	it('wraps the window in the chosen padding on every side', () => {
		const l = layoutSnap(base);
		const pad = PADDING_PX.m;
		expect(l.window.x).toBe(pad);
		expect(l.window.y).toBe(pad);
		expect(l.width).toBe(l.window.width + pad * 2);
		expect(l.height).toBe(l.window.height + pad * 2);
	});

	it('grows with content and has a minimum width', () => {
		const narrow = layoutSnap({ ...base, contentWidth: 10 });
		const wide = layoutSnap({ ...base, contentWidth: 1200 });
		expect(narrow.window.width).toBe(360);
		expect(wide.window.width).toBe(1200 + 48);
		const tall = layoutSnap({ ...base, lineCount: 20 });
		expect(tall.window.height - layoutSnap(base).window.height).toBe(220);
	});

	it('adds a title bar only with chrome', () => {
		const withChrome = layoutSnap(base);
		const without = layoutSnap({ ...base, chrome: 'none' });
		expect(withChrome.titleBar?.height).toBe(40);
		expect(without.titleBar).toBeNull();
		expect(withChrome.window.height).toBeGreaterThan(without.window.height);
		expect(withChrome.code.y).toBeGreaterThan(withChrome.window.y + 40);
	});

	it('reserves a gutter for line numbers sized to the digits', () => {
		const plain = layoutSnap(base);
		const numbered = layoutSnap({ ...base, lineNumbers: true, startLine: 120 });
		// 3 digits × 8px + 20px gap
		expect(numbered.code.x - plain.code.x).toBe(44);
		expect(numbered.gutterRight).toBe(numbered.code.x - 20);
		expect(plain.gutterRight).toBeNull();
	});

	it('makes room for an outside watermark under small padding', () => {
		const s = layoutSnap({ ...base, padding: 's', watermark: 'outside' });
		const bottom = s.height - (s.window.y + s.window.height);
		expect(bottom).toBe(56);
		expect(s.watermark?.align).toBe('center');
		expect(s.watermark?.y).toBeGreaterThan(s.window.y + s.window.height);
		const l = layoutSnap({ ...base, padding: 'l', watermark: 'outside' });
		expect(l.height - (l.window.y + l.window.height)).toBe(PADDING_PX.l);
	});

	it('puts an inside watermark in a footer within the window', () => {
		const inside = layoutSnap({ ...base, watermark: 'inside' });
		const none = layoutSnap(base);
		expect(inside.window.height).toBe(none.window.height + 28);
		expect(inside.watermark?.align).toBe('right');
		expect(inside.watermark?.y).toBeLessThan(inside.window.y + inside.window.height);
	});
});

describe('exportScale', () => {
	it('keeps 2× for normal snaps', () => {
		expect(exportScale(900, 700)).toBe(2);
	});

	it('shrinks to stay inside canvas limits', () => {
		expect(exportScale(1000, 10000)).toBeCloseTo(1.6384);
		const s = exportScale(9000, 9000);
		expect(9000 * 9000 * s * s).toBeLessThanOrEqual(120_000_000 + 1);
	});
});

describe('gradientLine', () => {
	it('matches CSS angles: 90deg runs left to right, 180deg top to bottom', () => {
		const h = gradientLine(90, 200, 100);
		expect(h.x0).toBeCloseTo(0);
		expect(h.x1).toBeCloseTo(200);
		expect(h.y0).toBeCloseTo(50);
		const v = gradientLine(180, 200, 100);
		expect(v.y0).toBeCloseTo(0);
		expect(v.y1).toBeCloseTo(100);
	});

	it('reaches the corners at 135deg on a square', () => {
		const d = gradientLine(135, 100, 100);
		expect(d.x0).toBeCloseTo(0);
		expect(d.y0).toBeCloseTo(0);
		expect(d.x1).toBeCloseTo(100);
		expect(d.y1).toBeCloseTo(100);
	});
});

describe('snapFileName', () => {
	it('uses the file stem', () => {
		expect(snapFileName('src/app/main.tsx')).toBe('main-snap.png');
		expect(snapFileName('C:\\proj\\my file.py')).toBe('my-file-snap.png');
		expect(snapFileName('.env')).toBe('.env-snap.png');
		expect(snapFileName('')).toBe('code-snap.png');
	});

	it('keeps non-ASCII letters and replaces only unsafe characters', () => {
		expect(snapFileName('données.py')).toBe('données-snap.png');
		expect(snapFileName('стратегия.py')).toBe('стратегия-snap.png');
		expect(snapFileName('a<b>:c"d|e?f*g.py')).toBe('a-b-c-d-e-f-g-snap.png');
	});
});

describe('ellipsize', () => {
	// One unit per code point, so widths read as character counts.
	const measure = (s: string): number => Array.from(s).length;

	it('leaves text that fits alone', () => {
		expect(ellipsize('main.py', 7, measure)).toBe('main.py');
	});

	it('keeps the longest prefix that fits with an ellipsis', () => {
		expect(ellipsize('a-very-long-name.py', 8, measure)).toBe('a-very-…');
		expect(ellipsize('abc', 1, measure)).toBe('…');
		expect(ellipsize('abc', 0, measure)).toBe('…');
	});

	it('never splits a surrogate pair', () => {
		expect(ellipsize('😀😀😀😀', 3, measure)).toBe('😀😀…');
	});
});

describe('withAlpha', () => {
	it('turns resolved tokens into rgb() with alpha', () => {
		expect(withAlpha('#22e5ff', 0.5)).toBe('rgb(34 229 255 / 0.5)');
		expect(withAlpha('#22e5ff80', 1)).toBe('rgb(34 229 255 / 0.502)');
		expect(withAlpha('#000000', 2)).toBe('rgb(0 0 0 / 1)');
	});

	it('passes through anything that is not #rrggbb(aa)', () => {
		expect(withAlpha('rgb(1, 2, 3)', 0.5)).toBe('rgb(1, 2, 3)');
	});
});

describe('clipRuns', () => {
	it('keeps short lines whole', () => {
		const runs = [{ text: 'abc' }, { text: 'de' }];
		expect(clipRuns(runs, 5)).toEqual(runs);
	});

	it('cuts long lines at the limit, ellipsis included', () => {
		const out = clipRuns(
			[
				{ text: 'abc', c: 1 },
				{ text: 'defgh', c: 2 },
				{ text: 'z', c: 3 },
			],
			6,
		);
		expect(out).toEqual([
			{ text: 'abc', c: 1 },
			{ text: 'de…', c: 2 },
		]);
		expect(out.map((r) => r.text).join('')).toHaveLength(6);
	});
});
