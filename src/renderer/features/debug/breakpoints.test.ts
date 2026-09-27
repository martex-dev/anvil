import { beforeEach, describe, expect, it } from 'vitest';

import { shiftLine } from '../editor/extras/bookmarks';
import { parseBreakpoints, placeKey, sourceBreakpoints, useBreakpoints } from './breakpoints';
import { absolutePath, relativePath } from './paths';

const store = (): ReturnType<typeof useBreakpoints.getState> => useBreakpoints.getState();

beforeEach(() => store().clear());

describe('breakpoints', () => {
	it('toggles, sets options on and removes breakpoints, sorted by place', () => {
		store().toggle('b.py', 3);
		store().toggle('a.py', 9);
		store().toggle('a.py', 2);
		expect(store().items.map((b) => `${b.path}:${b.line}`)).toEqual([
			'a.py:2',
			'a.py:9',
			'b.py:3',
		]);
		store().set('a.py', 9, { condition: ' x > 3 ', logMessage: '  ' });
		expect(store().items[1]).toEqual({
			path: 'a.py',
			line: 9,
			enabled: true,
			condition: 'x > 3',
		});
		store().toggle('a.py', 2);
		store().remove('b.py', 3);
		expect(store().items.map((b) => b.line)).toEqual([9]);
	});

	it('sends only enabled breakpoints of one file, with their options', () => {
		store().set('a.py', 4, { logMessage: 'x={x}' });
		store().toggle('a.py', 7);
		store().toggle('b.py', 1);
		store().setEnabled('a.py', 7, false);
		expect(sourceBreakpoints(store().items, 'a.py')).toEqual([
			{ line: 4, logMessage: 'x={x}' },
		]);
		store().setAllEnabled(true);
		expect(sourceBreakpoints(store().items, 'a.py').map((b) => b.line)).toEqual([4, 7]);
	});

	it('follows edits: lines inserted above push it down, deleted lines fold them together', () => {
		store().toggle('a.py', 5);
		store().toggle('a.py', 8);
		const before = store().items;
		// Two lines typed at the top of the file.
		const insert = [
			{
				range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
				text: 'a\nb\n',
			},
		];
		store().relocate('a.py', (line) => shiftLine(line, insert));
		expect(store().items.map((b) => b.line)).toEqual([7, 10]);
		// Deleting lines 6–10 (joined into line 6) takes both onto line 6: one breakpoint stays.
		const del = [
			{
				range: { startLineNumber: 6, startColumn: 1, endLineNumber: 11, endColumn: 1 },
				text: '',
			},
		];
		store().relocate('a.py', (line) => shiftLine(line, del));
		expect(store().items.map((b) => b.line)).toEqual([6]);
		// An edit below every breakpoint leaves the list (and its identity) alone.
		const items = store().items;
		store().relocate('a.py', (line) => line);
		expect(store().items).toBe(items);
		expect(items).not.toBe(before);
	});

	it('tracks which breakpoints the adapter could not place, per file', () => {
		store().setRejected('a.py', [3, 4]);
		store().setRejected('b.py', [1]);
		store().setRejected('a.py', [4]);
		expect([...store().rejected].sort()).toEqual([placeKey('a.py', 4), placeKey('b.py', 1)]);
	});

	it('reads stored breakpoints defensively', () => {
		expect(
			parseBreakpoints([
				{ path: 'a.py', line: 3, enabled: false, condition: 'i == 2' },
				{ path: 'a.py', line: 0 },
				{ path: 'b.py', line: 1.5 },
				{ line: 3 },
				'junk',
				{ path: 'a.py', line: 1 },
			]),
		).toEqual([
			{ path: 'a.py', line: 1, enabled: true },
			{ path: 'a.py', line: 3, enabled: false, condition: 'i == 2' },
		]);
		expect(parseBreakpoints({})).toEqual([]);
	});
});

describe('debug paths', () => {
	it('joins workspace paths with the root’s own separators', () => {
		expect(absolutePath('C:\\Users\\PC Games\\proj\\', 'src/a.py')).toBe(
			'C:\\Users\\PC Games\\proj\\src\\a.py',
		);
		expect(absolutePath('/home/m/proj', 'src/a.py')).toBe('/home/m/proj/src/a.py');
	});

	it('maps adapter paths back, case-insensitively on Windows, and refuses outside ones', () => {
		const root = 'C:\\Users\\PC Games\\proj';
		expect(relativePath(root, 'c:\\users\\pc games\\proj\\src\\a.py')).toBe('src/a.py');
		expect(relativePath(root, 'C:\\Users\\PC Games\\anaconda3\\Lib\\runpy.py')).toBeNull();
		expect(relativePath(root, 'C:\\Users\\PC Games\\project\\a.py')).toBeNull();
		expect(relativePath('/home/m/proj', '/home/m/Proj/a.py')).toBeNull();
		expect(relativePath('/home/m/proj', '/home/m/proj/a.py')).toBe('a.py');
	});
});
