import { describe, expect, it } from 'vitest';

import type { DataPage } from '@shared/ipc/channels/data';

import { pageKey, sameFilePlaceholder } from './use-data-pages';

const page: DataPage = {
	format: 'csv',
	columns: [{ name: 'a', type: 'int' }],
	rows: [['1']],
	totalRows: 1,
	loadedRows: 1,
	truncated: false,
	engine: 'built-in',
};

describe('sameFilePlaceholder', () => {
	const placeholder = sameFilePlaceholder('C:\\data\\b.csv');

	it('keeps the previous page across a filter or sort change in the same file', () => {
		const key = pageKey({ path: 'C:\\data\\b.csv', filter: 'x', sort: null }, 0);
		expect(placeholder(page, { queryKey: key })).toBe(page);
	});

	it('drops the previous page when it came from another file', () => {
		const key = pageKey({ path: 'C:\\data\\a.csv', filter: '', sort: null }, 0);
		expect(placeholder(page, { queryKey: key })).toBeUndefined();
		expect(placeholder(undefined, undefined)).toBeUndefined();
	});
});
