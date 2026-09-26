import { describe, expect, it } from 'vitest';

import { capRows, refocusIndex } from './change-rows';

describe('capRows', () => {
	it('keeps short lists whole', () => {
		const items = ['a', 'b'];
		expect(capRows(items, 3)).toEqual({ shown: items, hidden: 0 });
		expect(capRows(items, 2)).toEqual({ shown: items, hidden: 0 });
	});

	it('cuts long lists and counts what was left out', () => {
		const items = Array.from({ length: 25_000 }, (_, i) => i);
		const { shown, hidden } = capRows(items);
		expect(shown).toHaveLength(1000);
		expect(shown.at(-1)).toBe(999);
		expect(hidden).toBe(24_000);
	});
});

describe('refocusIndex', () => {
	it("focuses the row that took the moved row's place", () => {
		expect(refocusIndex(2, 5)).toBe(2);
	});

	it('falls back to the last row, or nothing when the list emptied', () => {
		expect(refocusIndex(4, 4)).toBe(3);
		expect(refocusIndex(0, 0)).toBeNull();
	});
});
