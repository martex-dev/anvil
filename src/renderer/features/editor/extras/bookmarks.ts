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

const KEY = 'anvil.bookmarks';

function load(): Bookmark[] {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
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
		return [];
	}
}

export const useBookmarks = create<BookmarkState>((set) => ({
	items: load(),
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

useBookmarks.subscribe((s) => {
	try {
		localStorage.setItem(KEY, JSON.stringify(s.items));
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
