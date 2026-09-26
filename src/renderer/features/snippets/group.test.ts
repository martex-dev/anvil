import { describe, expect, it } from 'vitest';

import { groupByCategory } from './group';
import { type Snippet, SNIPPET_CATEGORIES, SNIPPETS } from './library';

const make = (id: string, category: Snippet['category']): Snippet => ({
	id,
	prefix: id,
	name: id,
	description: id,
	language: 'python',
	category,
	body: id,
});

describe('groupByCategory', () => {
	it('orders groups by their first member and keeps member order', () => {
		const groups = groupByCategory([make('a', 'ML'), make('b', 'Quant'), make('c', 'ML')]);
		expect(groups.map((g) => g.category)).toEqual(['ML', 'Quant']);
		expect(groups[0]?.snippets.map((s) => s.id)).toEqual(['a', 'c']);
	});

	it('returns no groups for no snippets', () => {
		expect(groupByCategory([])).toEqual([]);
	});

	it('keeps every library snippet', () => {
		const total = groupByCategory(SNIPPETS).reduce((n, g) => n + g.snippets.length, 0);
		expect(total).toBe(SNIPPETS.length);
	});
});

describe('SNIPPET_CATEGORIES', () => {
	it('lists exactly the categories the library uses', () => {
		const used = new Set(SNIPPETS.map((s) => s.category));
		expect(new Set(SNIPPET_CATEGORIES)).toEqual(used);
		expect(new Set(SNIPPET_CATEGORIES).size).toBe(SNIPPET_CATEGORIES.length);
	});
});
