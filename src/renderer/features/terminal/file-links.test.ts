import { describe, expect, it } from 'vitest';

import { findFileLinks, toRelative } from './file-links';

const ROOT = 'C:\\Users\\me\\lab';

describe('terminal file links', () => {
	it('links Python traceback lines inside the folder', () => {
		const line = '  File "C:\\Users\\me\\lab\\src\\strategy.py", line 42, in sharpe';
		expect(findFileLinks(line, ROOT)).toEqual([
			{ start: 7, end: 49, path: 'src/strategy.py', line: 42, column: 1 },
		]);
	});

	it('skips files outside the folder (site-packages)', () => {
		const line = '  File "C:\\Python312\\Lib\\site-packages\\polars\\frame.py", line 9';
		expect(findFileLinks(line, ROOT)).toEqual([]);
	});

	it('links ruff/pytest style and TypeScript style references', () => {
		expect(findFileLinks('src/risk.py:12:5: E501 Line too long', ROOT)[0]).toMatchObject({
			path: 'src/risk.py',
			line: 12,
			column: 5,
		});
		expect(findFileLinks("src/app.ts(7,3): error TS2322: Type 'x'", ROOT)[0]).toMatchObject({
			path: 'src/app.ts',
			line: 7,
			column: 3,
		});
		expect(findFileLinks('tests/test_a.py:30: AssertionError', ROOT)[0]?.line).toBe(30);
	});

	it('ignores times and plain numbers', () => {
		expect(findFileLinks('done in 12:30:05, 3.5s', ROOT)).toEqual([]);
	});

	it('normalises relative and absolute paths', () => {
		expect(toRelative('./a/b.py', ROOT)).toBe('a/b.py');
		expect(toRelative('..\\x.py', ROOT)).toBeNull();
		expect(toRelative('c:/users/me/lab/X.py', ROOT)).toBe('X.py');
	});
});
