import { describe, expect, it } from 'vitest';

import { tableFromText } from './text-reader';

describe('tableFromText', () => {
	it('drops the cut-off last row of a truncated CSV', () => {
		const t = tableFromText('a,b\n1,2\n3,4\n5,6', 'csv', true);
		expect(t.rows).toEqual([
			['1', '2'],
			['3', '4'],
		]);
		expect(t.truncated).toBe(true);
	});

	it('keeps the last row of a complete CSV without a trailing newline', () => {
		expect(tableFromText('a,b\n1,2\n3,4', 'csv', false).rows).toHaveLength(2);
	});

	it('names the file line of a bad JSONL record, counting blank lines', () => {
		expect(() => tableFromText('{"a":1}\n\n{"a":2}\n{"a":}\n', 'jsonl', false)).toThrow(
			/^Invalid JSON on line 4: /,
		);
		expect(tableFromText('{"a":1}\n\n{"a":2}\n', 'jsonl', false).rows).toEqual([['1'], ['2']]);
	});

	it('flags truncation only when rows were actually left out', () => {
		expect(tableFromText('a\n1\n2\n', 'csv', false, 2).truncated).toBe(false);
		expect(tableFromText('a\n1\n2\n3\n', 'csv', false, 2)).toMatchObject({ truncated: true });
		expect(tableFromText('{"a":1}\n{"a":2}\n\n', 'jsonl', false, 2).truncated).toBe(false);
		const jsonl = tableFromText('{"a":1}\n{"a":2}\n{"a":3}\n', 'jsonl', false, 2);
		expect(jsonl).toMatchObject({ truncated: true, rows: [['1'], ['2']] });
		expect(tableFromText('[1,2]', 'json', false, 2).truncated).toBe(false);
		expect(tableFromText('[1,2,3]', 'json', false, 2)).toMatchObject({
			truncated: true,
			rows: [['1'], ['2']],
		});
	});
});
