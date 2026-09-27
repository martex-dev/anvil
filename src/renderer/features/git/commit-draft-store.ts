import { create } from 'zustand';

interface CommitDraftState {
	/** Unsent commit message per workspace root. */
	drafts: Record<string, string>;
	setDraft: (root: string, message: string) => void;
	/** Roots whose next commit amends the last one (the Amend checkbox). */
	amending: Record<string, boolean>;
	setAmending: (root: string, on: boolean) => void;
	/**
	 * Root whose message the AI is streaming, if any. Kept here, not in the component, so a
	 * view switch mid-stream doesn't hand back an editable, committable half-written message.
	 */
	writingRoot: string | null;
	setWritingRoot: (root: string | null) => void;
}

/**
 * The commit message outlives the Source Control view: the side bar shows one view at a time,
 * so a message kept in component state was lost on a glance at Explorer or Search.
 */
export const useCommitDrafts = create<CommitDraftState>((set) => ({
	drafts: {},
	setDraft: (root, message) =>
		set((s) => ({
			drafts: Object.fromEntries([
				...Object.entries(s.drafts).filter(([key]) => key !== root),
				...(message ? [[root, message] as const] : []),
			]),
		})),
	amending: {},
	setAmending: (root, on) => set((s) => ({ amending: { ...s.amending, [root]: on } })),
	writingRoot: null,
	setWritingRoot: (root) => set({ writingRoot: root }),
}));
