import { create } from 'zustand';

interface CommitFocusState {
	/** A focus request the commit box has not acted on yet. */
	pending: boolean;
	request: () => void;
	/** Clears a pending request; true if there was one to act on. */
	consume: () => boolean;
}

/**
 * Set by "Git: Commit…" so the commit box focuses its message. A pending flag rather than a
 * counter: the box may not be mounted yet (view just opened, status still loading), and it
 * takes the request once it mounts without refocusing on every later remount.
 */
export const useCommitFocus = create<CommitFocusState>((set, get) => ({
	pending: false,
	request: () => set({ pending: true }),
	consume: () => {
		if (!get().pending) return false;
		set({ pending: false });
		return true;
	},
}));
