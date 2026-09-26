import { describe, expect, it } from 'vitest';

import { rovingIndex, rovingTarget } from './roving';

describe('rovingTarget', () => {
	it('moves with the arrow keys and clamps at the ends', () => {
		expect(rovingTarget('ArrowDown', 0, 3)).toBe(1);
		expect(rovingTarget('ArrowDown', 2, 3)).toBe(2);
		expect(rovingTarget('ArrowUp', 1, 3)).toBe(0);
		expect(rovingTarget('ArrowUp', 0, 3)).toBe(0);
	});

	it('jumps with Home and End', () => {
		expect(rovingTarget('Home', 2, 3)).toBe(0);
		expect(rovingTarget('End', 0, 3)).toBe(2);
	});

	it('starts at the first item when nothing in the list has focus', () => {
		expect(rovingTarget('ArrowDown', -1, 3)).toBe(0);
		expect(rovingTarget('ArrowUp', -1, 3)).toBe(0);
	});

	it('ignores other keys and empty lists', () => {
		expect(rovingTarget('Enter', 0, 3)).toBeNull();
		expect(rovingTarget('ArrowDown', 0, 0)).toBeNull();
	});
});

describe('rovingIndex', () => {
	it('moves and wraps with the arrow keys', () => {
		expect(rovingIndex('ArrowRight', 0, 3)).toBe(1);
		expect(rovingIndex('ArrowRight', 2, 3)).toBe(0);
		expect(rovingIndex('ArrowLeft', 0, 3)).toBe(2);
	});

	it('jumps to the ends and ignores other keys', () => {
		expect(rovingIndex('Home', 2, 3)).toBe(0);
		expect(rovingIndex('End', 0, 3)).toBe(2);
		expect(rovingIndex('Enter', 0, 3)).toBeNull();
		expect(rovingIndex('ArrowRight', 0, 0)).toBeNull();
	});
});
