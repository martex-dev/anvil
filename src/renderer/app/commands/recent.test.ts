import { describe, expect, it } from 'vitest';

import { bumpRecent } from './recent';

describe('recent commands', () => {
	it('moves the command to the front without duplicates', () => {
		expect(bumpRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
		expect(bumpRecent([], 'x')).toEqual(['x']);
	});

	it('caps the list', () => {
		expect(bumpRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
	});
});
