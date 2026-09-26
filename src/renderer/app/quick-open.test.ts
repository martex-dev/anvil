import { describe, expect, it } from 'vitest';

import { quickOpenFilter, quickOpenMode, resolvePendingEnter } from './quick-open';

describe('quickOpenFilter', () => {
	it('matches commands and symbols despite the mode prefix', () => {
		expect(quickOpenFilter('Git Commit', '>git')).toBeGreaterThan(0);
		expect(quickOpenFilter('Git Commit', '> commit')).toBeGreaterThan(0);
		expect(quickOpenFilter('load_prices function', '@load')).toBeGreaterThan(0);
	});

	it('shows everything for a bare prefix and still filters non-matches', () => {
		expect(quickOpenFilter('Git Commit', '>')).toBeGreaterThan(0);
		expect(quickOpenFilter('load_prices function', '@')).toBeGreaterThan(0);
		expect(quickOpenFilter('Git Commit', '>zzz')).toBe(0);
	});
});

describe('quickOpenMode', () => {
	it('picks the mode from the prefix', () => {
		expect(quickOpenMode('>x')).toBe('commands');
		expect(quickOpenMode('@')).toBe('symbols');
		expect(quickOpenMode(':12')).toBe('line');
		expect(quickOpenMode('main.py')).toBe('files');
	});
});

describe('resolvePendingEnter', () => {
	it('opens the first match for the query Enter was pressed on', () => {
		expect(resolvePendingEnter('mai', 'mai', false, 'src/main.py')).toEqual({
			open: 'src/main.py',
			cancel: false,
		});
	});

	it('waits while the list is loading', () => {
		expect(resolvePendingEnter('mai', 'mai', true, undefined)).toEqual({
			open: undefined,
			cancel: false,
		});
	});

	it('cancels when the list arrives without a match or the query changes', () => {
		expect(resolvePendingEnter('zz', 'zz', false, undefined).cancel).toBe(true);
		expect(resolvePendingEnter('zz', 'main', false, 'src/main.py')).toEqual({
			open: undefined,
			cancel: true,
		});
	});
});
