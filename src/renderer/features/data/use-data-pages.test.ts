import { describe, expect, it } from 'vitest';

import type { DataPage } from '@shared/ipc/channels/data';

import { dataKeys, pageKey, sameFilePlaceholder } from './use-data-pages';

const page: DataPage = {
	format: 'csv',
	columns: [{ name: 'a', type: 'int' }],
	rows: [['1']],
	totalRows: 1,
	loadedRows: 1,
	truncated: false,
	engine: 'built-in',
};

const ROOT = 'C:\\proj';

describe('sameFilePlaceholder', () => {
	const placeholder = sameFilePlaceholder(ROOT, 'data/b.csv');

	it('keeps the previous page across a filter or sort change in the same file', () => {
		const key = pageKey({ root: ROOT, path: 'data/b.csv', filter: 'x', sort: null }, 0);
		expect(placeholder(page, { queryKey: key })).toBe(page);
	});

	it('drops the previous page when it came from another file', () => {
		const key = pageKey({ root: ROOT, path: 'data/a.csv', filter: '', sort: null }, 0);
		expect(placeholder(page, { queryKey: key })).toBeUndefined();
		expect(placeholder(undefined, undefined)).toBeUndefined();
	});

	it('drops the previous page when the same path belongs to another folder', () => {
		const key = pageKey({ root: 'C:\\other', path: 'data/b.csv', filter: '', sort: null }, 0);
		expect(placeholder(page, { queryKey: key })).toBeUndefined();
	});
});

describe('dataKeys', () => {
	it('keys the same relative path in two folders apart', () => {
		const a = pageKey({ root: 'C:\\a', path: 'data.csv', filter: '', sort: null }, 0);
		const b = pageKey({ root: 'C:\\b', path: 'data.csv', filter: '', sort: null }, 0);
		expect(a).not.toEqual(b);
		// Reloads drop a table's pages by this prefix.
		expect(a.slice(0, 4)).toEqual(dataKeys.page('C:\\a', 'data.csv'));
	});
});
