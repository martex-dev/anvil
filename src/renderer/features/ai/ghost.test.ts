import { describe, expect, it } from 'vitest';

import { ghostCacheKey, shouldSuggest, trimOverlap } from './ghost';

describe('ghost text heuristics', () => {
	it('suggests at the end of a line or before closing brackets', () => {
		expect(shouldSuggest('def sharpe(r', ')')).toBe(true);
		expect(shouldSuggest('    return ', '')).toBe(true);
		expect(shouldSuggest('x = foo(', '])')).toBe(true);
	});

	it('stays quiet in the middle of code', () => {
		expect(shouldSuggest('prin', 't(x)')).toBe(false);
		expect(shouldSuggest('x = ', 'y + 1')).toBe(false);
	});

	it('trims text that already follows the cursor', () => {
		expect(trimOverlap('returns.std())', '))\nnext')).toBe('returns.std(');
		expect(trimOverlap('x = 1', '')).toBe('x = 1');
	});
});

describe('ghost cache key', () => {
	const base = { path: 'a.py', offset: 10, prefix: 'x = ', suffix: '\ny = 2', model: 'a|m1' };

	it('changes when the code after the cursor changes', () => {
		expect(ghostCacheKey({ ...base, suffix: '\ny = 3' })).not.toBe(ghostCacheKey(base));
	});

	it('changes when the autocomplete model changes', () => {
		expect(ghostCacheKey({ ...base, model: 'a|m2' })).not.toBe(ghostCacheKey(base));
	});

	it('is stable for the same request', () => {
		expect(ghostCacheKey({ ...base })).toBe(ghostCacheKey(base));
	});
});
