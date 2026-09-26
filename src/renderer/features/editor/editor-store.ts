import { create } from 'zustand';

export type OpenFileState = 'loading' | 'ready' | 'binary' | 'tooLarge' | 'error';

export interface OpenFile {
	/** Workspace-relative path; also the tab id. */
	path: string;
	name: string;
	state: OpenFileState;
	error?: string | undefined;
	dirty: boolean;
	/** Disk mtime of the version we last loaded or saved (for conflict detection). */
	mtimeMs: number;
	/** The file changed on disk while it had unsaved edits here. */
	changedOnDisk: boolean;
}

/** Selections longer than this (Ctrl+A on a dump) aren't copied out or word-counted. */
export const MAX_COUNTED_SELECTION = 500_000;

/** Words in a selection for the status bar; huge selections aren't counted. */
export function countWords(text: string): number {
	if (!text || text.length > MAX_COUNTED_SELECTION) return 0;
	return text.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

export interface CursorInfo {
	line: number;
	column: number;
	language: string;
	eol: 'LF' | 'CRLF';
	/** Characters selected (0 when the selection is empty). */
	selected: number;
	selectedLines: number;
	selectedWords: number;
	lines: number;
	tabSize: number;
	insertSpaces: boolean;
}

/** Where the cursor last was in one editor group, kept while another group has focus. */
export interface GroupLine {
	path: string;
	line: number;
}

export interface RevealRequest {
	path: string;
	line: number;
	column: number;
	/** The editor group the file was opened in: the same file may be shown in both. */
	group: number;
	/** Whether revealing also moves keyboard focus into the editor. */
	focus: boolean;
}

interface EditorState {
	files: OpenFile[];
	active: string | null;
	cursor: CursorInfo | null;
	/** Last cursor line per editor group, so an unfocused group's breadcrumbs stay put. */
	groupLines: Readonly<Record<number, GroupLine>>;
	/**
	 * Files whose save hit a changed-on-disk conflict, oldest first. EditorDialogs asks about the
	 * first (overwrite / reload); Save All can queue several.
	 */
	conflicts: string[];
	/** Position to scroll to once the file's model is shown. */
	reveal: RevealRequest | null;
	/** Dirty file whose close is waiting for Save / Don't Save / Cancel. */
	closing: string | null;
	/** Bumped (debounced) when the focused editor's text changes; views like Outline follow it. */
	contentVersion: number;
	bumpContent: () => void;
	add: (file: OpenFile) => void;
	update: (path: string, patch: Partial<OpenFile>) => void;
	remove: (path: string) => void;
	setActive: (path: string | null) => void;
	setCursor: (cursor: CursorInfo | null) => void;
	setGroupLine: (group: number, line: GroupLine | null) => void;
	queueConflict: (path: string) => void;
	dropConflict: (path: string) => void;
	setReveal: (reveal: RevealRequest | null) => void;
	setClosing: (path: string | null) => void;
	reset: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
	files: [],
	active: null,
	cursor: null,
	groupLines: {},
	conflicts: [],
	reveal: null,
	closing: null,
	contentVersion: 0,
	bumpContent: () => set((s) => ({ contentVersion: s.contentVersion + 1 })),
	// `active` follows the tab in front (EditorBridge): a file that loads in the background, or a
	// session restore, must not steal it from the one on screen.
	add: (file) => set((s) => ({ files: [...s.files, file] })),
	update: (path, patch) =>
		set((s) => ({ files: s.files.map((f) => (f.path === path ? { ...f, ...patch } : f)) })),
	remove: (path) =>
		set((s) => ({
			files: s.files.filter((f) => f.path !== path),
			conflicts: s.conflicts.filter((p) => p !== path),
			// The tabs store picks the next tab (and EditorBridge mirrors it); never point at a
			// buffer that no longer exists.
			active: s.active === path ? null : s.active,
		})),
	setActive: (active) => set({ active }),
	setCursor: (cursor) => set({ cursor }),
	setGroupLine: (group, line) =>
		set((s) => {
			const current = s.groupLines[group];
			if (line && current?.path === line.path && current.line === line.line) return s;
			if (!line && !current) return s;
			const others = Object.entries(s.groupLines).filter(([g]) => Number(g) !== group);
			return {
				groupLines: Object.fromEntries(line ? [...others, [group, line]] : others),
			};
		}),
	queueConflict: (path) =>
		set((s) => (s.conflicts.includes(path) ? s : { conflicts: [...s.conflicts, path] })),
	dropConflict: (path) => set((s) => ({ conflicts: s.conflicts.filter((p) => p !== path) })),
	setReveal: (reveal) => set({ reveal }),
	setClosing: (closing) => set({ closing }),
	reset: () =>
		set({
			files: [],
			active: null,
			cursor: null,
			groupLines: {},
			conflicts: [],
			reveal: null,
			closing: null,
		}),
}));

export function dirtyCount(): number {
	return useEditorStore.getState().files.filter((f) => f.dirty).length;
}
