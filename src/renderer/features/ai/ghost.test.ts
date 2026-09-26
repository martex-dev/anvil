import { describe, expect, it } from 'vitest';

import { shouldSuggest, trimOverlap } from './ghost';

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
