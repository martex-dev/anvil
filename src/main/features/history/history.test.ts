import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HistoryStore } from './index';

let dir: string;
let clock: number;
let store: HistoryStore;
const root = 'C:\\proj';

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-hist-'));
	clock = 1_700_000_000_000;
	store = new HistoryStore(dir, () => clock);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('HistoryStore', () => {
	it('stores snapshots newest first and reads them back', () => {
		store.snapshot(root, 'a.py', 'v1');
		clock += 1000;
		store.snapshot(root, 'a.py', 'v2');
		const list = store.list(root, 'a.py');
		expect(list.map((s) => s.time)).toEqual([clock, clock - 1000]);
		expect(store.read(root, 'a.py', list[1]?.id ?? '')).toBe('v1');
	});

	it('skips a save that did not change the content', () => {
		store.snapshot(root, 'a.py', 'same');
		clock += 1;
		store.snapshot(root, 'a.py', 'same');
		expect(store.list(root, 'a.py')).toHaveLength(1);
	});

	it('keeps at most 50 snapshots and drops ones older than 30 days', () => {
		for (let i = 0; i < 55; i++) {
			clock += 1000;
			store.snapshot(root, 'b.py', `v${i}`);
		}
		expect(store.list(root, 'b.py')).toHaveLength(50);
		clock += 31 * 24 * 60 * 60 * 1000;
		store.snapshot(root, 'b.py', 'fresh');
		expect(store.list(root, 'b.py')).toHaveLength(1);
	});

	it('keeps files of different folders apart and rejects bad ids', () => {
		store.snapshot(root, 'a.py', 'x');
		expect(store.list('D:\\other', 'a.py')).toEqual([]);
		expect(() => store.read(root, 'a.py', '../../secrets')).toThrow();
	});
});
