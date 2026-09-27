import { useQuery } from '@tanstack/react-query';

import type { Settings } from '@shared/settings';

import { SETTINGS_KEY } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import { refreshGit, useGitRemote } from './git-ops';

export const AUTO_FETCH_MS = 5 * 60_000;

/**
 * Background `git fetch --prune` every 5 minutes while a repository is open (the gitAutoFetch
 * setting), so ahead/behind and the remote branch list stay right without a manual fetch.
 * A react-query query rather than a timer: every view that reads the git status calls this,
 * and the shared key keeps it to one fetch schedule for the whole window.
 */
export function useGitAutoFetch(root: string | null, isRepo: boolean): void {
	const { data: enabled = true } = useQuery({
		queryKey: SETTINGS_KEY,
		queryFn: () => call('settings:get'),
		select: (s: Settings) => s.gitAutoFetch,
	});
	useQuery({
		queryKey: ['git', 'autoFetch', root],
		queryFn: async () => {
			// A pull or push the user started already talks to the remote.
			if (useGitRemote.getState().running !== null) return Date.now();
			try {
				await call('git:fetch', { background: true });
				await refreshGit();
			} catch {
				// Offline, VPN down or a sign-in needed: main logs it, and a toast every five
				// minutes would only nag. The next manual fetch, pull or push reports it.
			}
			return Date.now();
		},
		enabled: enabled && isRepo && root !== null,
		refetchInterval: AUTO_FETCH_MS,
		// A hidden window doesn't need fresh counts; focusing it again fetches if they're stale.
		refetchIntervalInBackground: false,
		staleTime: AUTO_FETCH_MS,
		retry: false,
	});
}
