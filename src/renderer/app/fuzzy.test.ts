import { describe, expect, it } from 'vitest';

import { fuzzyFilter, fuzzyMatch } from './fuzzy';

const files = [
	'src/strategy/backtest.py',
	'src/strategy/momentum.py',
	'data/prices.parquet',
	'notebooks/explore.py',
	'README.md',
	'src/research/parquet/deep/io.py',
];

const highlighted = (query: string, path: string): string =>
	(fuzzyMatch(query, path)?.indices ?? []).map((i) => path[i]).join('');

describe('fuzzy', () => {
	it('matches characters in order and rejects missing ones', () => {
		expect(fuzzyMatch('bt', 'src/strategy/backtest.py')).not.toBeNull();
		expect(fuzzyMatch('xyz', 'src/strategy/backtest.py')).toBeNull();
		expect(fuzzyMatch('tb', 'backtest')).toBeNull();
	});

	it('ranks file-name matches above deep path matches', () => {
		expect(fuzzyFilter('parq', files)[0]?.path).toBe('data/prices.parquet');
		expect(fuzzyFilter('mom', files)[0]?.path).toBe('src/strategy/momentum.py');
	});

	it('returns everything for an empty query', () => {
		expect(fuzzyFilter('', files)).toHaveLength(files.length);
	});

	it('picks the best place to match, not the leftmost', () => {
		const path = 'app/dashboard/data/x.py';
		const m = fuzzyMatch('data', path);
		// The whole `data` segment, not d-a from `dashboard`.
		expect(m?.indices).toEqual([14, 15, 16, 17]);
		expect(highlighted('data', path)).toBe('data');
	});

	it('prefers contiguous runs and word starts', () => {
		expect(fuzzyFilter('data', ['app/dashboard/data/x.py', 'd/a/t/a.py'])[0]?.path).toBe(
			'app/dashboard/data/x.py',
		);
		// Segment starts: s(trategy) b(acktest).
		expect(fuzzyMatch('stbt', 'src/strategy/backtest.py')?.indices).toEqual([4, 5, 13, 17]);
		// camelCase humps count as word starts.
		expect(highlighted('lp', 'src/loadPrices.ts')).toBe('lP');
	});

	it('prefers a match in the file name', () => {
		const ranked = fuzzyFilter('util', ['src/utils/a.py', 'src/lib/util.py']);
		expect(ranked[0]?.path).toBe('src/lib/util.py');
	});

	it('scores 50k paths quickly', () => {
		const paths = Array.from(
			{ length: 50_000 },
			(_, i) => `packages/pkg${i % 97}/src/module${i % 541}/component_${i}.tsx`,
		);
		const start = performance.now();
		const out = fuzzyFilter('mod12comp', paths);
		const ms = performance.now() - start;
		expect(out.length).toBeGreaterThan(0);
		// A generous bound for a loaded CI machine; typically well under half of it.
		expect(ms).toBeLessThan(1500);
	});
});
