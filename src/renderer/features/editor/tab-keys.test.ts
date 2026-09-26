import { describe, expect, it } from 'vitest';

import { tabKeyTarget } from './tab-keys';

describe('tabKeyTarget', () => {
	const ids = ['a', 'b', 'c'];

	it('moves to the neighbour and wraps at both ends', () => {
		expect(tabKeyTarget('ArrowRight', ids, 'a')).toBe('b');
		expect(tabKeyTarget('ArrowRight', ids, 'c')).toBe('a');
		expect(tabKeyTarget('ArrowLeft', ids, 'b')).toBe('a');
		expect(tabKeyTarget('ArrowLeft', ids, 'a')).toBe('c');
	});

	it('jumps to the first and last tab', () => {
		expect(tabKeyTarget('Home', ids, 'b')).toBe('a');
		expect(tabKeyTarget('End', ids, 'a')).toBe('c');
	});

	it('ignores other keys and unknown tabs', () => {
		expect(tabKeyTarget('Enter', ids, 'a')).toBeNull();
		expect(tabKeyTarget('ArrowRight', ids, 'zzz')).toBeNull();
	});
});
