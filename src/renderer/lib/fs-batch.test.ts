import { describe, expect, it } from 'vitest';

import { touchesFile } from './fs-batch';

describe('touchesFile', () => {
	it('matches listed files', () => {
		expect(touchesFile({ dirs: [], files: ['a.py'] }, 'a.py')).toBe(true);
		expect(touchesFile({ dirs: ['src'], files: ['a.py'] }, 'b.py')).toBe(false);
	});

	it('treats an overflow batch as touching every file', () => {
		expect(touchesFile({ dirs: [], files: [], overflow: true }, 'b.py')).toBe(true);
	});
});
