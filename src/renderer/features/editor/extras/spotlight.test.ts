import { describe, expect, it } from 'vitest';

import { spotlightBlock } from './spotlight';

describe('spotlightBlock', () => {
	it('lights the # %% cell in Python', () => {
		const lines = ['import x', '# %% A', 'a = 1', 'b = 2', '# %% B', 'c = 3'];
		expect(spotlightBlock('python', lines, 3)).toEqual({ start: 2, end: 4 });
	});

	it('falls back to the enclosing function, trimming trailing blank lines', () => {
		const lines = ['def f():', '\treturn 1', '', '', 'def g():', '\tpass'];
		expect(spotlightBlock('python', lines, 2)).toEqual({ start: 1, end: 2 });
	});

	it('uses the paragraph when there is no symbol', () => {
		const lines = ['a', 'b', '', 'c', 'd', 'e', '', 'f'];
		expect(spotlightBlock('plaintext', lines, 5)).toEqual({ start: 4, end: 6 });
	});
});
