import { create } from 'zustand';

export interface OpenFileRequest {
	path: string;
	/** Optional 1-based position to reveal (search results, diagnostics). */
	line?: number | undefined;
	column?: number | undefined;
	/** Single-click in a list: reuse the preview tab instead of opening another. */
	preview?: boolean;
	/** Force a viewer, e.g. open a CSV as plain text. */
	as?: 'code' | 'data' | 'markdown';
	/** Open in the other editor group (split). */
	side?: boolean;
	/** Add the tab without switching to it (files a refactoring touched). */
	background?: boolean;
	/**
	 * Move keyboard focus into the editor. Defaults to true, except for previews (single clicks
	 * in a list keep focus in the list). Session restore passes false.
	 */
	focus?: boolean;
	/**
	 * List the file in Quick Open's recent files. Defaults to true; navigation (Back / Forward,
	 * go to definition) passes false so jumps don't reshuffle the list.
	 */
	remember?: boolean;
}

type OpenFileHandler = (request: OpenFileRequest) => void;

/** A file the explorer should reveal and focus; `nonce` makes a repeat request count again. */
export interface RevealRequest {
	path: string;
	nonce: number;
}
/** Returns a human-readable reason to block leaving the workspace, or null to allow it. */
/**
 * Asked before the folder or the window goes away (`action` reads like "closing the window").
 * Resolves true to allow it, e.g. once unsaved files are saved or deliberately discarded.
 */
type LeaveGuard = (action: string) => Promise<boolean>;

interface WorkbenchState {
	/** Workspace-relative path of the file focused in the editor, if any. */
	activeFile: string | null;
	openFileHandler: OpenFileHandler | null;
	leaveGuards: ReadonlySet<LeaveGuard>;
	/** Pending "Reveal in Explorer View"; the explorer clears it once handled. */
	reveal: RevealRequest | null;
	setActiveFile: (path: string | null) => void;
	setOpenFileHandler: (handler: OpenFileHandler | null) => void;
	addLeaveGuard: (guard: LeaveGuard) => () => void;
	requestReveal: (path: string) => void;
	clearReveal: () => void;
	/**
	 * A file to open once the editor is ready for it: after a folder switch finished restoring
	 * its tabs (a launch path, "Open with Anvil"). The editor takes it (takePendingOpen).
	 */
	pendingOpen: OpenFileRequest | null;
	queueOpen: (request: OpenFileRequest | null) => void;
}

/** Never reset, so a request made after the last one was cleared still reads as new. */
let revealCount = 0;

/**
 * Tiny bus between modules that must not import each other: the explorer (or search, git…)
 * asks to open a file; whichever editor module is enabled registers the handler.
 */
export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
	activeFile: null,
	openFileHandler: null,
	leaveGuards: new Set(),
	reveal: null,
	setActiveFile: (activeFile) => set({ activeFile }),
	setOpenFileHandler: (openFileHandler) => set({ openFileHandler }),
	addLeaveGuard: (guard) => {
		set({ leaveGuards: new Set([...get().leaveGuards, guard]) });
		return () => {
			const next = new Set(get().leaveGuards);
			next.delete(guard);
			set({ leaveGuards: next });
		};
	},
	requestReveal: (path) => set({ reveal: { path, nonce: ++revealCount } }),
	clearReveal: () => set({ reveal: null }),
	pendingOpen: null,
	queueOpen: (pendingOpen) => set({ pendingOpen }),
}));

/** The queued file to open, once; null when there's none. */
export function takePendingOpen(): OpenFileRequest | null {
	const request = useWorkbenchStore.getState().pendingOpen;
	if (request) useWorkbenchStore.getState().queueOpen(null);
	return request;
}

/** Returns false when no editor module is available to handle the request. */
export function requestOpenFile(request: OpenFileRequest): boolean {
	const handler = useWorkbenchStore.getState().openFileHandler;
	if (!handler) return false;
	handler(request);
	return true;
}

/** Runs every leave guard in turn; false as soon as one of them says no. */
export async function confirmLeave(action: string): Promise<boolean> {
	for (const guard of useWorkbenchStore.getState().leaveGuards) {
		if (!(await guard(action))) return false;
	}
	return true;
}
