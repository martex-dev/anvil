import { describe, expect, it } from 'vitest';

import type { SearchFile } from '@shared/ipc/channels/search';

import { fileMatchCount } from './search-count';

describe('fileMatchCount', () => {
	it('counts every match on a line, like the result summary', () => {
		const file: SearchFile = {
			path: 'src/a.py',
			capped: false,
			matches: [
				{
					line: 1,
					column: 1,
					text: 'px = px + px',
					ranges: [
						[0, 2],
						[5, 7],
						[10, 12],
					],
				},
				{ line: 4, column: 1, text: 'return px', ranges: [[7, 9]] },
				{ line: 9, column: 1, text: 'px', ranges: [] },
			],
		};
		expect(fileMatchCount(file)).toBe(5);
	});
});
