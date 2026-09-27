import { create } from 'zustand';

import { call } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { toast, useToastStore } from '../../stores/toast-store';
import { invalidateGitLines } from '../editor/extras/git-lines';

export const GIT_STATUS_KEY = ['git', 'status'] as const;
/** Prefix of every Source Control mutation, so one git operation can wait for another. */
export const GIT_MUTATION_KEY = ['git'] as const;

/** Re-reads the status and the editor's change markers after a git operation. */
export function refreshGit(): Promise<void> {
	invalidateGitLines();
	return queryClient.invalidateQueries({ queryKey: GIT_STATUS_KEY });
}

/**
 * Source Control operations in flight that aren't react-query mutations (discard, stash, init,
 * branch and palette operations). Counted so the panel's buttons are disabled meanwhile.
 */
export const useGitOps = create<{ count: number }>(() => ({ count: 0 }));

/** Any git operation running: a panel mutation, a pull/push, or a gitOp. */
export function gitBusyNow(): boolean {
	return (
		useGitOps.getState().count > 0 ||
		useGitRemote.getState().running !== null ||
		queryClient.isMutating({ mutationKey: GIT_MUTATION_KEY }) > 0
	);
}

/**
 * Runs one git operation: failures become a toast titled `failTitle`, and the status (and the
 * editor's change markers) refresh afterwards either way, since a failed stash pop or checkout
 * can still have changed files. Resolves undefined on failure; never rejects.
 */
export async function gitOp<T>(failTitle: string, op: () => Promise<T>): Promise<T | undefined> {
	useGitOps.setState((s) => ({ count: s.count + 1 }));
	try {
		return await op();
	} catch (error) {
		toast.error(failTitle, error instanceof Error ? error.message : undefined);
		return undefined;
	} finally {
		await refreshGit();
		useGitOps.setState((s) => ({ count: s.count - 1 }));
	}
}

export type RemoteOp = 'pull' | 'push';

/**
 * The pull or push in flight. Shared by the Source Control panel and the palette commands, so
 * both show the same progress and neither can start a second network operation meanwhile.
 */
export const useGitRemote = create<{ running: RemoteOp | null }>(() => ({ running: null }));

const TEXT: Record<RemoteOp, { progress: string; done: string; failed: string }> = {
	pull: { progress: 'Pulling…', done: 'Pulled', failed: 'Pull failed' },
	push: { progress: 'Pushing…', done: 'Pushed', failed: 'Push failed' },
};

/**
 * Runs `git pull`/`git push` and toasts the outcome. `announce` adds a progress toast for
 * callers with no spinner of their own (the palette). Resolves to whether it succeeded; it
 * never rejects.
 */
export async function runRemote(op: RemoteOp, options: { announce: boolean }): Promise<boolean> {
	const running = useGitRemote.getState().running;
	if (running || gitBusyNow()) {
		toast.info(
			'Git is busy',
			running ? `Wait for the ${running} to finish.` : 'Wait for it to finish.',
		);
		return false;
	}
	useGitRemote.setState({ running: op });
	const text = TEXT[op];
	const progress = options.announce
		? useToastStore
				.getState()
				.push({ title: text.progress, tone: 'info', durationMs: Number.POSITIVE_INFINITY })
		: null;
	try {
		const { summary } = await call(op === 'pull' ? 'git:pull' : 'git:push');
		toast.success(text.done, summary);
		return true;
	} catch (error) {
		toast.error(text.failed, error instanceof Error ? error.message : undefined);
		return false;
	} finally {
		if (progress !== null) useToastStore.getState().dismiss(progress);
		// Stay busy until the status is fresh, so no button acts on the pre-pull state.
		await refreshGit();
		useGitRemote.setState({ running: null });
	}
}
