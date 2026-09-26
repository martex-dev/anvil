import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
});

const { setBookmarksRoot, shiftLine, useBookmarks } = await import('./bookmarks');

const edit = (
	startLineNumber: number,
	startColumn: number,
	endLineNumber: number,
	endColumn: number,
	text: string,
): Parameters<typeof shiftLine>[1][number] => ({
	range: { startLineNumber, startColumn, endLineNumber, endColumn },
	text,
});

const mark = (path: string, line: number): { path: string; line: number; preview: string } => ({
	path,
	line,
	preview: '',
});

describe('bookmarks', () => {
	beforeEach(() => {
		setBookmarksRoot(null);
		storage.clear();
	});

	it('keeps a separate list per folder', () => {
		setBookmarksRoot('C:/Users/Marto/project-a');
		useBookmarks.getState().toggle(mark('README.md', 3));
		setBookmarksRoot('C:/Users/Marto/project-b');
		expect(useBookmarks.getState().items).toEqual([]);
		useBookmarks.getState().toggle(mark('src/main.py', 7));
		setBookmarksRoot('C:/Users/Marto/project-a');
		expect(useBookmarks.getState().items).toEqual([mark('README.md', 3)]);
		setBookmarksRoot('C:/Users/Marto/project-b');
		expect(useBookmarks.getState().items).toEqual([mark('src/main.py', 7)]);
	});

	it('matches the folder case-insensitively, like Windows paths', () => {
		setBookmarksRoot('C:/Proj');
		useBookmarks.getState().toggle(mark('a.py', 1));
		setBookmarksRoot(null);
		expect(useBookmarks.getState().items).toEqual([]);
		setBookmarksRoot('c:/proj');
		expect(useBookmarks.getState().items).toEqual([mark('a.py', 1)]);
	});
});

describe('shiftLine', () => {
	it('follows lines inserted or deleted above', () => {
		expect(shiftLine(10, [edit(2, 5, 2, 5, 'a\nb\n')])).toBe(12);
		expect(shiftLine(10, [edit(2, 1, 5, 1, '')])).toBe(7);
		expect(shiftLine(10, [edit(12, 1, 12, 1, '\n')])).toBe(10);
	});

	it('moves with its text when a newline is typed at the start of the line', () => {
		expect(shiftLine(4, [edit(4, 1, 4, 1, '\n')])).toBe(5);
		expect(shiftLine(4, [edit(4, 9, 4, 9, '\n')])).toBe(4);
	});

	it('lands where a deletion began, and follows a line joined upward', () => {
		expect(shiftLine(4, [edit(3, 1, 5, 1, '')])).toBe(3);
		expect(shiftLine(5, [edit(4, 20, 5, 1, '')])).toBe(4);
	});

	it('applies several changes of one event in document order', () => {
		// Monaco lists multi-cursor edits in either order; both are in pre-edit coordinates.
		const changes = [edit(1, 1, 1, 1, 'x\n'), edit(20, 1, 20, 1, 'y\n')];
		expect(shiftLine(10, changes)).toBe(11);
		expect(shiftLine(25, changes)).toBe(27);
		expect(shiftLine(25, [...changes].reverse())).toBe(27);
	});
});

describe('relocate', () => {
	beforeEach(() => {
		setBookmarksRoot(null);
		storage.clear();
		setBookmarksRoot('C:/proj');
	});

	it('moves one file and merges bookmarks that land on the same line', () => {
		const s = useBookmarks.getState();
		s.toggle(mark('a.py', 3));
		s.toggle(mark('a.py', 4));
		s.toggle(mark('b.py', 4));
		s.relocate('a.py', (b) => ({ ...b, line: 3 }));
		expect(useBookmarks.getState().items).toEqual([mark('a.py', 3), mark('b.py', 4)]);
	});

	it('leaves the state untouched when nothing moved', () => {
		useBookmarks.getState().toggle(mark('a.py', 3));
		const before = useBookmarks.getState().items;
		useBookmarks.getState().relocate('a.py', (b) => b);
		expect(useBookmarks.getState().items).toBe(before);
	});
});
