import { create } from 'zustand';

import { useLayoutStore } from '../../stores/layout-store';

export interface ConfirmRequest {
	title: string;
	description: string;
	/** Label of the button that goes ahead, e.g. "Discard 3 Files". */
	confirmLabel: string;
	/** Destroys work git can't bring back (untracked files, a dropped stash). */
	danger?: boolean;
}

interface Pending extends ConfirmRequest {
	resolve: (ok: boolean) => void;
}

/**
 * The Source Control view's pending question. A store rather than component state so palette
 * commands can ask too: they show the Git view, whose dialog host picks the request up on mount.
 */
export const useGitConfirm = create<{ pending: Pending | null }>(() => ({ pending: null }));

/** Asks the user in the Git view; resolves false when dismissed or replaced by a newer question. */
export function confirmGit(request: ConfirmRequest): Promise<boolean> {
	useGitConfirm.getState().pending?.resolve(false);
	useLayoutStore.getState().showView('git');
	return new Promise((resolve) => {
		useGitConfirm.setState({ pending: { ...request, resolve } });
	});
}

export function answerGitConfirm(ok: boolean): void {
	const pending = useGitConfirm.getState().pending;
	if (!pending) return;
	useGitConfirm.setState({ pending: null });
	pending.resolve(ok);
}
