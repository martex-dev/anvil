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
	if (running || queryClient.isMutating({ mutationKey: GIT_MUTATION_KEY }) > 0) {
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
