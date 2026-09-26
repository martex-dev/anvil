import { describe, expect, it } from 'vitest';

import { parseMatch, ResultCollector, splitGlobs } from './rg-parse';

const match = (path: string, text: string, line: number, subs: Array<[number, number]>): string =>
	JSON.stringify({
		type: 'match',
		data: {
			path: { text: path },
			lines: { text },
			line_number: line,
			absolute_offset: 0,
			submatches: subs.map(([start, end]) => ({ match: { text: 'x' }, start, end })),
		},
	});

describe('parseMatch', () => {
	it('converts UTF-8 byte offsets to string indices and strips indentation', () => {
		// "é" is 2 bytes in UTF-8: "caféX" → X at byte 5, index 4.
		const parsed = parseMatch(JSON.parse(match('src\\a.ts', '\t\tcaféX = 1\n', 3, [[7, 8]])));
		expect(parsed).toEqual({
			path: 'src/a.ts',
			match: { line: 3, column: 7, text: 'caféX = 1', ranges: [[4, 5]] },
		});
	});

	it('drops highlight ranges that fall inside the stripped indentation', () => {
		// `^\s+` on "\t\tx = 1": the whole match is indentation; the column still points at it.
		const inside = parseMatch(JSON.parse(match('a.py', '\t\tx = 1\n', 1, [[0, 2]])));
		expect(inside?.match).toEqual({ line: 1, column: 1, text: 'x = 1', ranges: [] });
		// A match spanning the indentation and the code keeps only its visible part.
		const spanning = parseMatch(JSON.parse(match('a.py', '  xy\n', 1, [[1, 3]])));
		expect(spanning?.match.ranges).toEqual([[0, 1]]);
	});

	it('windows very long lines around the first match', () => {
		const long = `${'a'.repeat(1000)}NEEDLE${'b'.repeat(1000)}`;
		const parsed = parseMatch(JSON.parse(match('min.js', long, 1, [[1000, 1006]])));
		const text = parsed?.match.text ?? '';
		const [start, end] = parsed?.match.ranges[0] ?? [0, 0];
		expect(text.startsWith('…')).toBe(true);
		expect(text.length).toBeLessThanOrEqual(401);
		expect(text.slice(start, end)).toBe('NEEDLE');
	});

	it('skips binary lines (bytes instead of text)', () => {
		const event = {
			type: 'match',
			data: { path: { text: 'x' }, lines: { bytes: 'AAE=' }, line_number: 1, submatches: [] },
		};
		expect(parseMatch(event as never)).toBeNull();
	});
});

describe('ResultCollector', () => {
	it('groups by file, ignores other events and stops at the limit', () => {
		const c = new ResultCollector(3);
		expect(c.add(JSON.stringify({ type: 'begin', data: {} }))).toBe(true);
		expect(c.add('not json')).toBe(true);
		expect(
			c.add(
				match('a.py', 'foo foo', 1, [
					[0, 3],
					[4, 7],
				]),
			),
		).toBe(true);
		expect(c.add(match('b.py', 'foo', 2, [[0, 3]]))).toBe(false);
		expect(c.add(match('a.py', 'foo', 9, [[0, 3]]))).toBe(false);
		expect(c.truncated).toBe(true);
		expect(c.result().map((f) => [f.path, f.matches.length])).toEqual([
			['a.py', 1],
			['b.py', 1],
		]);
	});
});

describe('ResultCollector per-file cap', () => {
	it('marks files that reached the per-file line cap', () => {
		const c = new ResultCollector(100, 2);
		c.add(match('full.py', 'foo', 1, [[0, 3]]));
		c.add(match('full.py', 'foo', 2, [[0, 3]]));
		c.add(match('one.py', 'foo', 1, [[0, 3]]));
		expect(c.result().map((f) => [f.path, f.capped ?? false])).toEqual([
			['full.py', true],
			['one.py', false],
		]);
	});
});

describe('splitGlobs', () => {
	it('splits and trims comma-separated globs', () => {
		expect(splitGlobs(' src/**, *.py ,, ')).toEqual(['src/**', '*.py']);
	});
});
