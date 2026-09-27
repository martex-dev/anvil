import { GitCommitHorizontal } from 'lucide-react';

import type { GitCommit } from '@shared/ipc/channels/git';

import { call } from '../../lib/ipc';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { baseName, diffLanguage } from './open-diff';

const HISTORY_LIMIT = 200;

/**
 * Opens what `commit` changed in a file as a diff tab: the file in the commit's parent (at its
 * old path when the commit renamed it) against the file in the commit.
 */
export async function openCommitDiff(commit: GitCommit, workspacePath: string): Promise<void> {
	const path = commit.path;
	if (!path) return;
	const name = baseName(path);
	const short = commit.hash.slice(0, 7);
	try {
		const [before, after] = await Promise.all([
			call('git:show', { hash: commit.hash, path: commit.from ?? path, parent: true }),
			call('git:show', { hash: commit.hash, path }),
		]);
		if (before.binary || after.binary) {
			toast.info('Binary file', `${name} can't be shown as a text diff.`);
			return;
		}
		useTabsStore.getState().open({
			id: `diff:commit:${commit.hash}:${path}`,
			kind: 'diff',
			path: null,
			title: `${name} (${short})`,
			preview: true,
			diff: {
				title: `${path} · ${short}^ ↔ ${short} · ${commit.message}`,
				original: before.content ?? '',
				modified: after.content ?? '',
				language: diffLanguage(name, workspacePath),
				path: workspacePath,
			},
		});
	} catch (error) {
		toast.error('Could not load the diff', error instanceof Error ? error.message : undefined);
	}
}

/** "Git: File History": the commits that touched the focused file, newest first. */
export async function showFileHistory(): Promise<void> {
	const tab = focusedTab(useTabsStore.getState());
	const workspacePath = tab?.path;
	if (!workspacePath) {
		toast.info('Open a file first', 'File History lists the commits of the focused file.');
		return;
	}
	const commits = call('git:log', { limit: HISTORY_LIMIT, path: workspacePath });
	const picked = await quickPick({
		title: 'history',
		placeholder: `Commits that changed ${baseName(workspacePath)} (Enter opens the diff)`,
		loadErrorTitle: 'Could not read the file history',
		items: commits.then((list) =>
			list.map((c) => ({
				id: c.hash,
				label: c.message,
				description: `${c.author} · ${new Date(c.date).toLocaleString([], { hour12: false })}`,
				detail: `${c.hash.slice(0, 10)}${c.from ? `  (renamed from ${c.from})` : ''}`,
				icon: <GitCommitHorizontal size={13} />,
			})),
		),
	});
	if (!picked) return;
	const commit = (await commits).find((c) => c.hash === picked);
	if (commit) await openCommitDiff(commit, workspacePath);
}
