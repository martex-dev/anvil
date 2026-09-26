import { describe, expect, it } from 'vitest';

import { isNearBottom } from './use-stick-to-bottom';

describe('isNearBottom', () => {
	it('follows while the list is at (or just short of) the end', () => {
		expect(isNearBottom({ scrollHeight: 1000, scrollTop: 600, clientHeight: 400 })).toBe(true);
		expect(isNearBottom({ scrollHeight: 1000, scrollTop: 570, clientHeight: 400 })).toBe(true);
	});

	it('stops following once the user scrolls up', () => {
		expect(isNearBottom({ scrollHeight: 1000, scrollTop: 200, clientHeight: 400 })).toBe(false);
	});
});
