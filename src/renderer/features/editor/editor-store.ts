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

/** Words in a selection for the status bar; huge selections (Ctrl+A on a dump) aren't counted. */
export function countWords(text: string): number {
	if (!text || text.length > 500_000) return 0;
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

export interface RevealRequest {
	path: string;
	line: number;
	column: number;
}

interface EditorState {
	files: OpenFile[];
	active: string | null;
	cursor: CursorInfo | null;
	/** Save conflict awaiting a decision (overwrite / reload). */
	conflict: string | null;
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
	setConflict: (path: string | null) => void;
	setReveal: (reveal: RevealRequest | null) => void;
	setClosing: (path: string | null) => void;
	reset: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
	files: [],
	active: null,
	cursor: null,
	conflict: null,
	reveal: null,
	closing: null,
	contentVersion: 0,
	bumpContent: () => set((s) => ({ contentVersion: s.contentVersion + 1 })),
	add: (file) => set((s) => ({ files: [...s.files, file], active: file.path })),
	update: (path, patch) =>
		set((s) => ({ files: s.files.map((f) => (f.path === path ? { ...f, ...patch } : f)) })),
	remove: (path) =>
		set((s) => {
			const index = s.files.findIndex((f) => f.path === path);
			const files = s.files.filter((f) => f.path !== path);
			// Closing the active tab activates its right neighbour, like VS Code.
			const next = s.active === path ? (files[index] ?? files[index - 1] ?? null) : null;
			return { files, active: s.active === path ? (next?.path ?? null) : s.active };
		}),
	setActive: (active) => set({ active }),
	setCursor: (cursor) => set({ cursor }),
	setConflict: (conflict) => set({ conflict }),
	setReveal: (reveal) => set({ reveal }),
	setClosing: (closing) => set({ closing }),
	reset: () =>
		set({ files: [], active: null, cursor: null, conflict: null, reveal: null, closing: null }),
}));

export function dirtyCount(): number {
	return useEditorStore.getState().files.filter((f) => f.dirty).length;
}
