import { describe, expect, it } from 'vitest';

import { ghostCacheKey, mayAutocomplete, shouldSuggest, trimOverlap } from './ghost';

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

describe('ghost text and secrets', () => {
	const key = `sk-ant-${'a1B2'.repeat(10)}`;

	it('never autocompletes in key files', () => {
		expect(mayAutocomplete('.env', 'DB_URL=', '')).toBe(false);
		expect(mayAutocomplete('certs/server.pem', '', '')).toBe(false);
	});

	it('skips code with a secret around the cursor, even one split by it', () => {
		expect(mayAutocomplete('app.py', `api_key = "${key}"\n`, '')).toBe(false);
		expect(
			mayAutocomplete('app.py', `api_key = "${key.slice(0, 20)}`, `${key.slice(20)}"`),
		).toBe(false);
		expect(mayAutocomplete('app.py', 'x = ', '\ny = 2')).toBe(true);
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
