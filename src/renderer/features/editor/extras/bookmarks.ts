import type * as Monaco from 'monaco-editor';
import { create } from 'zustand';

import type { MonacoApi } from '../../../lib/monaco/setup';
import { toWorkspacePath } from '../../../lib/monaco/workspace-root';

export interface Bookmark {
	path: string;
	line: number;
	/** The line's text when bookmarked, shown in the list. */
	preview: string;
}

interface BookmarkState {
	items: Bookmark[];
	toggle: (b: Bookmark) => void;
	remove: (path: string, line: number) => void;
	clear: () => void;
}

/**
 * Bookmarks hold workspace-relative paths, so each folder keeps its own list: `src/main.py` in
 * one project is not `src/main.py` in another.
 */
const keyFor = (root: string): string => `anvil.bookmarks:${root.toLowerCase()}`;

/** The folder whose bookmarks are loaded (set by EditorBridge); null before one is open. */
let currentRoot: string | null = null;
/** True while swapping in another folder's list, so that swap isn't saved back. */
let switching = false;

function load(root: string | null): Bookmark[] {
	if (!root) return [];
	try {
		const raw = JSON.parse(localStorage.getItem(keyFor(root)) ?? '[]') as unknown;
		return Array.isArray(raw)
			? raw.filter(
					(b): b is Bookmark =>
						typeof b === 'object' &&
						b !== null &&
						typeof (b as Bookmark).path === 'string' &&
						typeof (b as Bookmark).line === 'number',
				)
			: [];
	} catch {
		// Storage blocked or a corrupt value: start this folder with no bookmarks.
		return [];
	}
}

export const useBookmarks = create<BookmarkState>((set) => ({
	items: [],
	toggle: (b) =>
		set((s) => ({
			items: s.items.some((x) => x.path === b.path && x.line === b.line)
				? s.items.filter((x) => !(x.path === b.path && x.line === b.line))
				: [...s.items, b].sort((x, y) => x.path.localeCompare(y.path) || x.line - y.line),
		})),
	remove: (path, line) =>
		set((s) => ({ items: s.items.filter((x) => !(x.path === path && x.line === line)) })),
	clear: () => set({ items: [] }),
}));

/** Shows the bookmarks of the folder that is now open. */
export function setBookmarksRoot(root: string | null): void {
	if (root === currentRoot) return;
	currentRoot = root;
	switching = true;
	try {
		useBookmarks.setState({ items: load(root) });
	} finally {
		switching = false;
	}
}

useBookmarks.subscribe((s) => {
	if (switching || !currentRoot) return;
	try {
		localStorage.setItem(keyFor(currentRoot), JSON.stringify(s.items));
	} catch {
		// Losing bookmarks on a full storage is acceptable.
	}
});

export function toggleBookmarkAt(editor: Monaco.editor.IStandaloneCodeEditor): void {
	const model = editor.getModel();
	const pos = editor.getPosition();
	const path = model ? toWorkspacePath(model.uri) : null;
	if (!model || !pos || !path) return;
	useBookmarks.getState().toggle({
		path,
		line: pos.lineNumber,
		preview: model.getLineContent(pos.lineNumber).trim().slice(0, 120),
	});
}

/** Next bookmark after the cursor in this file, wrapping around. */
export function nextBookmarkLine(editor: Monaco.editor.IStandaloneCodeEditor): number | null {
	const model = editor.getModel();
	const path = model ? toWorkspacePath(model.uri) : null;
	const line = editor.getPosition()?.lineNumber ?? 0;
	const lines = useBookmarks
		.getState()
		.items.filter((b) => b.path === path)
		.map((b) => b.line);
	return lines.find((l) => l > line) ?? lines[0] ?? null;
}

export function attachBookmarks(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	const deco = editor.createDecorationsCollection();
	const paint = (): void => {
		const model = editor.getModel();
		const path = model ? toWorkspacePath(model.uri) : null;
		if (!model || !path) return deco.clear();
		deco.set(
			useBookmarks
				.getState()
				.items.filter((b) => b.path === path && b.line <= model.getLineCount())
				.map((b) => ({
					range: new monaco.Range(b.line, 1, b.line, 1),
					options: {
						glyphMarginClassName: 'anvil-bookmark',
						glyphMarginHoverMessage: { value: 'Bookmark' },
					},
				})),
		);
	};
	const off = useBookmarks.subscribe(paint);
	const sub = editor.onDidChangeModel(paint);
	paint();
	return {
		dispose() {
			off();
			sub.dispose();
			deco.clear();
		},
	};
}
