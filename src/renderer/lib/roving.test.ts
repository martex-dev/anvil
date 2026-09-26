import { describe, expect, it } from 'vitest';

import { rovingIndex } from './roving';

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
