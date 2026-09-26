import { describe, expect, it } from 'vitest';

import { extractCode, withCursor } from './inline-text';

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

describe('withCursor', () => {
	it('marks the cursor in a small file', () => {
		expect(withCursor('foo()', 4)).toBe('foo(<CURSOR/>)');
	});

	it('keeps the marker when the cursor is deep in a large file', () => {
		const text = 'a'.repeat(300_000) + 'b'.repeat(100_000);
		const out = withCursor(text, 300_000);
		expect(out).toContain('a<CURSOR/>b');
		expect(out.startsWith('… (truncated)\n')).toBe(true);
		expect(out.endsWith('\n… (truncated)')).toBe(true);
		expect(out.length).toBeLessThan(200_100);
	});

	it('uses the whole budget before the cursor near the end of the file', () => {
		const out = withCursor('x'.repeat(250_000), 250_000);
		expect(out.endsWith('x<CURSOR/>')).toBe(true);
		expect(out.length).toBe('… (truncated)\n'.length + 200_000 + '<CURSOR/>'.length);
	});
});
