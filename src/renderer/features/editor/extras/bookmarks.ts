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
	/** Rewrites one file's bookmarks (after an edit moved them); a no-op when nothing changed. */
	relocate: (path: string, map: (b: Bookmark) => Bookmark) => void;
	clear: () => void;
}

const byPlace = (x: Bookmark, y: Bookmark): number =>
	x.path.localeCompare(y.path) || x.line - y.line;

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
				: [...s.items, b].sort(byPlace),
		})),
	remove: (path, line) =>
		set((s) => ({ items: s.items.filter((x) => !(x.path === path && x.line === line)) })),
	relocate: (path, map) =>
		set((s) => {
			let changed = false;
			const seen = new Set<number>();
			const items: Bookmark[] = [];
			for (const b of s.items) {
				if (b.path !== path) {
					items.push(b);
					continue;
				}
				const next = map(b);
				if (next.line !== b.line || next.preview !== b.preview) changed = true;
				// Deleting the lines between two bookmarks folds them onto one line: keep one.
				if (seen.has(next.line)) {
					changed = true;
					continue;
				}
				seen.add(next.line);
				items.push(next);
			}
			return changed ? { items: items.sort(byPlace) } : s;
		}),
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

/** The parts of Monaco's content change a bookmark's line depends on. */
export interface LineEdit {
	range: {
		startLineNumber: number;
		startColumn: number;
		endLineNumber: number;
		endColumn: number;
	};
	text: string;
}

/**
 * Where a bookmark on `line` ends up after one content-change event, so it follows its code:
 * lines inserted or deleted above push it down or pull it up, a newline typed at its very start
 * pushes it down with the text, and a deleted line's bookmark lands where the deletion began.
 */
export function shiftLine(line: number, changes: readonly LineEdit[]): number {
	// Applied bottom-up, each change's range is still in the original coordinates.
	const ordered = [...changes].sort(
		(a, b) =>
			b.range.startLineNumber - a.range.startLineNumber ||
			b.range.startColumn - a.range.startColumn,
	);
	let result = line;
	for (const { range, text } of ordered) {
		const added = text.split('\n').length - 1;
		const removed = range.endLineNumber - range.startLineNumber;
		if (result > range.endLineNumber) result += added - removed;
		else if (result > range.startLineNumber) {
			// The bookmarked line was removed, or (the last line) had its start joined upward.
			result = range.startLineNumber + (result === range.endLineNumber ? added : 0);
		} else if (
			result === range.startLineNumber &&
			removed === 0 &&
			range.startColumn === 1 &&
			range.endColumn === 1
		) {
			result += added;
		}
	}
	return result;
}

/** A model's last change already applied to the store (two groups may show one file). */
const shiftedVersion = new WeakMap<Monaco.editor.ITextModel, number>();

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
						stickiness:
							monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
						// The lane right of the cells' run arrow (cells.ts), so both stay readable.
						glyphMargin: { position: monaco.editor.GlyphMarginLane.Right },
						glyphMarginClassName: 'anvil-bookmark',
						glyphMarginHoverMessage: { value: 'Bookmark' },
					},
				})),
		);
	};
	let previewTimer: ReturnType<typeof setTimeout> | undefined;
	const refreshPreviews = (model: Monaco.editor.ITextModel, path: string): void => {
		clearTimeout(previewTimer);
		previewTimer = setTimeout(() => {
			if (model.isDisposed()) return;
			useBookmarks
				.getState()
				.relocate(path, (b) =>
					b.line <= model.getLineCount()
						? { ...b, preview: model.getLineContent(b.line).trim().slice(0, 120) }
						: b,
				);
		}, 400);
	};
	// Lines move with the edit right away (so the gutter, list and Next Bookmark agree); the
	// previews catch up once typing pauses.
	const follow = (e: Monaco.editor.IModelContentChangedEvent): void => {
		const model = editor.getModel();
		const path = model ? toWorkspacePath(model.uri) : null;
		if (!model || !path || !useBookmarks.getState().items.some((b) => b.path === path)) return;
		if (shiftedVersion.get(model) === e.versionId) return;
		shiftedVersion.set(model, e.versionId);
		useBookmarks
			.getState()
			.relocate(path, (b) => ({ ...b, line: shiftLine(b.line, e.changes) }));
		refreshPreviews(model, path);
	};
	const off = useBookmarks.subscribe(paint);
	const subs = [editor.onDidChangeModel(paint), editor.onDidChangeModelContent(follow)];
	paint();
	return {
		dispose() {
			clearTimeout(previewTimer);
			off();
			for (const s of subs) s.dispose();
			deco.clear();
		},
	};
}
