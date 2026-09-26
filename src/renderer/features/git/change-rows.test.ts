import { describe, expect, it } from 'vitest';

import { capRows } from './change-rows';

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
