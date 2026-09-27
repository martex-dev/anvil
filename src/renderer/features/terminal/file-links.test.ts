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

	it('links absolute paths with spaces as the whole path', () => {
		const root = 'C:\\Users\\John Smith\\proj';
		const line = 'C:\\Users\\John Smith\\proj\\my pkg\\a.py:12: UserWarning: x';
		expect(findFileLinks(line, root)).toEqual([
			{ start: 0, end: 39, path: 'my pkg/a.py', line: 12, column: 1 },
		]);
		// Outside the folder: no link, and no partial relative link to "Smith\\...".
		expect(findFileLinks('C:\\Users\\John Smith\\other\\a.py:3:', root)).toEqual([]);
	});

	it('does not start a relative link inside a longer path', () => {
		expect(findFileLinks('https://example.com/src/a.py:3', ROOT)).toEqual([]);
	});

	it('normalises relative and absolute paths', () => {
		expect(toRelative('./a/b.py', ROOT)).toBe('a/b.py');
		expect(toRelative('..\\x.py', ROOT)).toBeNull();
		expect(toRelative('c:/users/me/lab/X.py', ROOT)).toBe('X.py');
		expect(toRelative('c:/users/me/lab/src/../X.py', ROOT)).toBe('X.py');
	});

	it('takes relative paths from the folder the terminal started in', () => {
		expect(toRelative('bt.py', ROOT, 'strategies')).toBe('strategies/bt.py');
		expect(toRelative('..\\data\\x.py', ROOT, 'strategies')).toBe('data/x.py');
		expect(toRelative('../../x.py', ROOT, 'strategies')).toBeNull();
		expect(findFileLinks('bt.py:3', ROOT, 'strategies')[0]?.path).toBe('strategies/bt.py');
	});

	it('does not link server addresses or version numbers', () => {
		expect(findFileLinks('Uvicorn running on http://0.0.0.0:8000', ROOT)).toEqual([]);
		expect(findFileLinks(' * Running on 127.0.0.1:5000', ROOT)).toEqual([]);
		expect(findFileLinks('numpy 1.26.4:2', ROOT)).toEqual([]);
	});

	it('links traceback and colon paths under a user folder with a space', () => {
		const root = 'C:\\Users\\PC Games\\lab';
		const traceback = '  File "C:\\Users\\PC Games\\lab\\bt.py", line 42, in <module>';
		expect(findFileLinks(traceback, root)[0]).toMatchObject({ path: 'bt.py', line: 42 });
		const colon = 'C:\\Users\\PC Games\\lab\\src\\bt.py:42:7 error';
		expect(findFileLinks(colon, root)[0]).toMatchObject({
			start: 0,
			path: 'src/bt.py',
			line: 42,
			column: 7,
		});
	});
});
