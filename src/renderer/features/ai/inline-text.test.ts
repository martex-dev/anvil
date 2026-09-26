import { describe, expect, it } from 'vitest';

import { extractCode } from './inline-text';

describe('extractCode', () => {
	it('takes the first fenced block', () => {
		expect(extractCode('Here:\n```py\n    return 1\n```\nDone.')).toBe('    return 1');
	});

	it('keeps the first line indented in an unfenced reply', () => {
		expect(extractCode('\n\n    def f(self):\n        return 1\n\n')).toBe(
			'    def f(self):\n        return 1',
		);
	});

	it('returns nothing for a blank reply', () => {
		expect(extractCode('  \n\t\n').trim()).toBe('');
	});
});
