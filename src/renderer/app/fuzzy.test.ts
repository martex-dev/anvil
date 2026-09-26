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

describe('fuzzy', () => {
	it('matches characters in order and rejects missing ones', () => {
		expect(fuzzyMatch('bt', 'src/strategy/backtest.py')).not.toBeNull();
		expect(fuzzyMatch('xyz', 'src/strategy/backtest.py')).toBeNull();
	});

	it('ranks file-name matches above deep path matches', () => {
		expect(fuzzyFilter('parq', files)[0]?.path).toBe('data/prices.parquet');
		expect(fuzzyFilter('mom', files)[0]?.path).toBe('src/strategy/momentum.py');
	});

	it('returns everything for an empty query', () => {
		expect(fuzzyFilter('', files)).toHaveLength(files.length);
	});
});
