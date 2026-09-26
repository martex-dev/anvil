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
});
