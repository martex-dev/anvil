import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GitStatus } from '@shared/ipc/channels/git';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { useGitAutoFetch } from './auto-fetch';
import { confirmGit } from './git-confirm';
import {
	GIT_MUTATION_KEY,
	GIT_STATUS_KEY,
	refreshGit,
	runRemote,
	useGitOps,
	useGitRemote,
} from './git-ops';

export { GIT_STATUS_KEY } from './git-ops';

/**
 * Repository status. Refreshed after Anvil's own git operations, on file changes, and by a
 * slow poll — commits/checkouts made in a terminal only touch .git, which the watcher ignores.
 */
export function useGitStatus(): {
	status: GitStatus | undefined;
	isLoading: boolean;
	error: Error | null;
	/** Resolves once the refetch has settled (it never rejects; failures land in `error`). */
	refetch: () => Promise<void>;
} {
	const client = useQueryClient();
	const { info } = useWorkspace();
	const query = useQuery({
		queryKey: [...GIT_STATUS_KEY, info.root],
		queryFn: () => call('git:status'),
		enabled: info.root !== null,
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
	});
	const refresh = (): void => void client.invalidateQueries({ queryKey: GIT_STATUS_KEY });
	useAnvilEvent('git:changed', refresh);
	useAnvilEvent('fs:changed', refresh);
	useGitAutoFetch(info.root, query.data?.isRepo ?? false);
	return {
		status: query.data,
		isLoading: query.isLoading,
		error: query.error,
		refetch: () => query.refetch().then(() => undefined),
	};
}

/**
 * Asks before staging conflicted files that still contain conflict markers: staging is how git
 * marks a conflict resolved, so a forgotten `<<<<<<<` would go into the commit as is. Resolves
 * whether to go ahead.
 */
async function confirmConflictStage(
	paths: string[],
	status: GitStatus | undefined,
): Promise<boolean> {
	const wanted = new Set(paths);
	const conflicted = (status?.unstaged ?? [])
		.filter((c) => c.kind === 'conflicted' && wanted.has(c.path))
		.map((c) => c.path);
	if (conflicted.length === 0) return true;
	let hits: string[];
	try {
		hits = await call('git:conflictMarkers', conflicted.slice(0, 5000));
	} catch (error) {
		toast.error(
			'Could not check for conflict markers',
			error instanceof Error ? error.message : undefined,
		);
		return false;
	}
	if (hits.length === 0) return true;
	const names = hits
		.slice(0, 3)
		.map((p) => p.split('/').at(-1) ?? p)
		.join(', ');
	return confirmGit({
		title: 'Stage files with conflict markers?',
		description: `${names}${hits.length > 3 ? ` and ${hits.length - 3} more` : ''} still contain${hits.length === 1 ? 's' : ''} <<<<<<< / >>>>>>> markers. Staging marks the conflict as resolved.`,
		confirmLabel: 'Stage Anyway',
	});
}

export function useGitActions(status?: GitStatus): {
	stage: (paths: string[]) => void;
	unstage: (paths: string[]) => void;
	commit: (message: string, amend?: boolean) => Promise<boolean>;
	pull: () => void;
	push: () => void;
	fetch: () => void;
	/** Per-operation progress, for a spinner on the button that started it. */
	pulling: boolean;
	pushing: boolean;
	fetching: boolean;
	busy: boolean;
} {
	// Returned so a mutation stays pending until the status has refreshed: the lists never
	// show a stale row as actionable, and focus can be restored against the new rows.
	const done = refreshGit;
	const running = useGitRemote((s) => s.running);
	const ops = useGitOps((s) => s.count);
	const fail = (what: string) => (error: Error) => toast.error(`${what} failed`, error.message);

	const stage = useMutation({
		mutationKey: [...GIT_MUTATION_KEY, 'stage'],
		mutationFn: (p: string[]) => call('git:stage', p),
		onSettled: done,
		onError: fail('Stage'),
	});
	const unstage = useMutation({
		mutationKey: [...GIT_MUTATION_KEY, 'unstage'],
		mutationFn: (p: string[]) => call('git:unstage', p),
		onSettled: done,
		onError: fail('Unstage'),
	});
	const commit = useMutation({
		mutationKey: [...GIT_MUTATION_KEY, 'commit'],
		mutationFn: async ({ message, amend }: { message: string; amend: boolean }) => {
			// Secret shield: never let an API key, private key or seed phrase into history.
			const findings = await call('git:scanStaged');
			const high = findings.filter((f) => f.severity === 'high');
			const f = high[0];
			if (f) {
				throw new Error(
					`Blocked by the secret shield: ${f.kind} (${f.preview}) in ${f.path ?? '?'}:${f.line}${high.length > 1 ? ` and ${high.length - 1} more` : ''}. Unstage it and load the value from .env instead.`,
				);
			}
			if (findings.length > 0)
				toast.warn(
					'Possible credential staged',
					`${findings[0]?.kind} in ${findings[0]?.path}:${findings[0]?.line}`,
				);
			return call('git:commit', { message, amend });
		},
		onSuccess: ({ hash }, { amend }) =>
			toast.success(amend ? 'Commit amended' : 'Committed', hash.slice(0, 7)),
		onSettled: done,
		onError: fail('Commit'),
	});

	return {
		stage: (paths) =>
			void confirmConflictStage(paths, status).then((ok) => {
				if (ok) stage.mutate(paths);
			}),
		unstage: unstage.mutate,
		commit: (message, amend = false) =>
			commit
				.mutateAsync({ message, amend })
				.then(() => true)
				.catch(() => false),
		// Shared with the palette's Pull/Push, which may already be running one; the buttons
		// have their own spinner, so no progress toast.
		pull: () => void runRemote('pull', { announce: false }),
		push: () => void runRemote('push', { announce: false }),
		fetch: () => void runRemote('fetch', { announce: false }),
		pulling: running === 'pull',
		pushing: running === 'push',
		fetching: running === 'fetch',
		busy: running !== null || ops > 0 || [stage, unstage, commit].some((m) => m.isPending),
	};
}
