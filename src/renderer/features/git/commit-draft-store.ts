import { create } from 'zustand';

interface CommitDraftState {
	/** Unsent commit message per workspace root. */
	drafts: Record<string, string>;
	setDraft: (root: string, message: string) => void;
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
}));
