import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
});

const { setBookmarksRoot, useBookmarks } = await import('./bookmarks');

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
