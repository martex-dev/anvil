import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DataFormat } from '@shared/ipc/channels/data';

import { DataStore, type LoadSpec, type PageQuery } from './store';

let dir = '';
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-data-'));
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function file(name: string, text: string, format: DataFormat = 'csv'): LoadSpec {
	const abs = join(dir, name);
	writeFileSync(abs, text);
	return { abs, rel: name, format, python: null };
}

const all: PageQuery = { offset: 0, limit: 100, sort: null, filter: '' };

describe('DataStore', () => {
	it('pages, filters and sorts a CSV', async () => {
		const store = new DataStore();
		const spec = file('a.csv', 'sym,px\nETH,3000\nBTC,65000\nSOL,150\n');
		const page = await store.page(spec, all);
		expect(page.columns.map((c) => c.name)).toEqual(['sym', 'px']);
		expect(page.totalRows).toBe(3);
		const sorted = await store.page(spec, { ...all, sort: { column: 1, desc: true } });
		expect(sorted.rows.map((r) => r[0])).toEqual(['BTC', 'ETH', 'SOL']);
		const filtered = await store.page(spec, { ...all, filter: 'sol' });
		expect(filtered.rows).toEqual([['SOL', '150']]);
	});

	it('profiles a string column with min and max', async () => {
		const store = new DataStore();
		const spec = file('b.csv', 'id\nx10\nx2\nx9\n');
		const stats = await store.stats(spec, 0);
		expect(stats).toMatchObject({ count: 3, min: 'x2', max: 'x10' });
	});
});
