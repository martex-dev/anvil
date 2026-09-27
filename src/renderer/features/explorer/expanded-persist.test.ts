import { describe, expect, it } from 'vitest';

import { loadExpanded, saveExpanded } from './expanded-persist';

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
	const data = new Map<string, string>();
	return {
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v),
		removeItem: (k) => void data.delete(k),
	};
}

describe('expanded folders', () => {
	it('round-trips per folder, case-insensitively', () => {
		const storage = memoryStorage();
		saveExpanded('C:\\Proj', new Set(['src', 'src/lib']), storage);
		expect(loadExpanded('c:\\proj', storage)).toEqual(new Set(['src', 'src/lib']));
		expect(loadExpanded('C:\\Other', storage)).toEqual(new Set());
	});

	it('forgets a fully collapsed tree and survives broken storage', () => {
		const storage = memoryStorage();
		saveExpanded('C:\\p', new Set(['a']), storage);
		saveExpanded('C:\\p', new Set(), storage);
		expect(loadExpanded('C:\\p', storage)).toEqual(new Set());
		storage.setItem('anvil.explorer.expanded:c:\\p', '{not json');
		expect(loadExpanded('C:\\p', storage)).toEqual(new Set());
		storage.setItem('anvil.explorer.expanded:c:\\p', '[1, "ok", ""]');
		expect(loadExpanded('C:\\p', storage)).toEqual(new Set(['ok']));
	});

	it('keeps the shallowest folders when over the cap', () => {
		const storage = memoryStorage();
		const deep = Array.from({ length: 600 }, (_, i) => `a/b/c${i}`);
		saveExpanded('C:\\p', new Set([...deep, 'a', 'a/b']), storage);
		const loaded = loadExpanded('C:\\p', storage);
		expect(loaded.size).toBe(500);
		expect(loaded.has('a')).toBe(true);
		expect(loaded.has('a/b')).toBe(true);
	});
});
