import { describe, expect, it } from 'vitest';

import { formatOf } from './index';
import { mapDtype } from './python-reader';
import {
	buildTable,
	columnStats,
	inferType,
	parseDelimited,
	sniffDelimiter,
	tableFromRecords,
	view,
} from './table';

describe('parseDelimited', () => {
	it('handles quotes, escaped quotes, embedded newlines and CRLF', () => {
		const csv = 'a,b,c\r\n1,"x, y",\r\n2,"he said ""hi""","multi\nline"\r\n';
		const { header, rows } = parseDelimited(csv, ',', 10);
		expect(header).toEqual(['a', 'b', 'c']);
		expect(rows).toEqual([
			['1', 'x, y', null],
			['2', 'he said "hi"', 'multi\nline'],
		]);
	});

	it('names blank headers and stops at maxRows', () => {
		const { header, rows, truncated } = parseDelimited(',b\n1,2\n3,4\n5,6\n', ',', 2);
		expect(header).toEqual(['column_1', 'b']);
		expect(rows).toHaveLength(2);
		expect(truncated).toBe(true);
	});

	it('keeps a quoted empty string as empty, not missing', () => {
		expect(parseDelimited('a\n""\n', ',', 5).rows).toEqual([['']]);
	});

	it('sniffs European semicolon exports', () => {
		expect(sniffDelimiter('date;close;volume\n')).toBe(';');
		expect(sniffDelimiter('a,b\n')).toBe(',');
	});
});

describe('types and views', () => {
	it('infers column types ignoring missing values', () => {
		expect(inferType(['1', null, '-3'])).toBe('int');
		expect(inferType(['1.5', '2', 'NaN', '1e-3'])).toBe('float');
		expect(inferType(['2024-01-02', '2024-01-03T10:00:00Z'])).toBe('date');
		expect(inferType(['true', 'False'])).toBe('bool');
		expect(inferType(['BTC', '1'])).toBe('string');
		expect(inferType([null, ''])).toBe('empty');
	});

	const table = buildTable(
		['sym', 'px'],
		[
			['ETH', '3000'],
			['BTC', '65000.5'],
			['SOL', null],
			['btc-perp', '65010'],
		],
		false,
		'built-in',
	);

	it('filters case-insensitively and sorts numbers numerically, missing last', () => {
		expect(view(table, 'btc', null)).toEqual([1, 3]);
		expect(view(table, '', { column: 1, desc: false })).toEqual([0, 1, 3, 2]);
		expect(view(table, '', { column: 1, desc: true })).toEqual([3, 1, 0, 2]);
	});

	it('computes numeric and categorical stats', () => {
		const s = columnStats(table, 1);
		expect(s).toMatchObject({ count: 3, nulls: 1, unique: 3, min: '3000', max: '65010' });
		expect(s.histogram).toHaveLength(20);
		expect(s.histogram.reduce((a, b) => a + b.count, 0)).toBe(3);
		const c = columnStats(table, 0);
		expect(c.mean).toBeNull();
		expect(c.histogram[0]).toMatchObject({ count: 1 });
	});

	it('turns records into a table with the union of keys', () => {
		const t = tableFromRecords([{ a: 1 }, { a: 2, b: { x: 1 } }], false);
		expect(t.columns.map((c) => c.name)).toEqual(['a', 'b']);
		expect(t.rows[1]).toEqual(['2', '{"x":1}']);
	});
});

describe('formats', () => {
	it('maps extensions and dtypes', () => {
		expect(formatOf('a/prices.parquet')).toBe('parquet');
		expect(formatOf('x.ndjson')).toBe('jsonl');
		expect(formatOf('x.py')).toBeNull();
		expect(mapDtype('Int64')).toBe('int');
		expect(mapDtype('float32')).toBe('float');
		expect(mapDtype("Datetime(time_unit='us', time_zone=None)")).toBe('date');
		expect(mapDtype('datetime64[ns]')).toBe('date');
		expect(mapDtype('object')).toBe('string');
	});
});
