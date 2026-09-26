import { create } from 'zustand';

interface CommitDraftState {
	/** Unsent commit messages by workspace root, so another folder never inherits one. */
	drafts: Readonly<Record<string, string>>;
	setDraft: (root: string, message: string) => void;
}

/**
 * The commit message being written. Kept outside CommitBox because the side bar unmounts the Git
 * view when you switch views, hide the side bar or enter Zen, which used to throw the text away.
 */
export const useCommitDraft = create<CommitDraftState>((set) => ({
	drafts: {},
	setDraft: (root, message) =>
		set((s) => {
			if (message) return { drafts: { ...s.drafts, [root]: message } };
			const { [root]: _cleared, ...rest } = s.drafts;
			return { drafts: rest };
		}),
}));
