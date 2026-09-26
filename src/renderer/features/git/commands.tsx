import {
	ArrowDown,
	ArrowDownUp,
	ArrowUp,
	FileDiff,
	GitBranch,
	GitCommitHorizontal,
	History,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { call } from '../../lib/ipc';
import { useLayoutStore } from '../../stores/layout-store';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { useCommitFocus } from './commit-focus';
import { refreshGit, runRemote } from './git-ops';

async function switchBranch(): Promise<void> {
	const picked = await quickPick({
		title: 'branch',
		placeholder: 'Switch to a branch, or type a new name to create it',
		loadErrorTitle: 'Could not list branches',
		items: call('git:branches').then((b) =>
			b.local.map((name) => ({
				id: name,
				label: name,
				current: name === b.current,
				icon: <GitBranch size={13} />,
			})),
		),
		allowCustom: { label: (text) => `Create branch "${text}" and switch to it` },
	});
	if (!picked) return;
	const create = picked.startsWith('custom:');
	const branch = create ? picked.slice(7) : picked;
	try {
		await call('git:checkout', { branch, create });
		toast.success(create ? 'Branch created' : 'Switched branch', branch);
	} catch (error) {
		toast.error('Checkout failed', error instanceof Error ? error.message : undefined);
	} finally {
		void refreshGit();
	}
}

async function showLog(): Promise<void> {
	const hash = await quickPick({
		title: 'log',
		placeholder: 'Recent commits (Enter copies the hash)',
		loadErrorTitle: 'Could not read the log',
		items: call('git:log', { limit: 200 }).then((commits) =>
			commits.map((c) => ({
				id: c.hash,
				label: c.message,
				description: `${c.author} · ${new Date(c.date).toLocaleString([], { hour12: false })}`,
				detail: `${c.hash.slice(0, 10)}${c.refs ? `  (${c.refs})` : ''}`,
				icon: <GitCommitHorizontal size={13} />,
			})),
		),
	});
	if (!hash) return;
	try {
		await navigator.clipboard.writeText(hash);
		toast.success('Commit hash copied', hash.slice(0, 10));
	} catch (error) {
		toast.error('Could not copy the hash', error instanceof Error ? error.message : undefined);
	}
}

async function diffActiveFile(): Promise<void> {
	const tab = focusedTab(useTabsStore.getState());
	if (!tab?.path) {
		toast.info('Open a file first', 'Diff Active File compares the focused file with HEAD.');
		return;
	}
	const status = await call('git:status').catch((error: unknown) => {
		toast.error(
			'Could not read git status',
			error instanceof Error ? error.message : undefined,
		);
		return null;
	});
	if (!status) return;
	// Outside a repository the change lists are empty, which is not "matches HEAD".
	if (!status.isRepo) {
		toast.info('Not a git repository', 'The open folder is not tracked by git.');
		return;
	}
	const change = [...status.unstaged, ...status.staged].find((c) => c.workspacePath === tab.path);
	if (!change) {
		toast.info('No changes', `${tab.path} matches HEAD.`);
		return;
	}
	const { openDiff } = await import('./GitPanel');
	await openDiff(change, status.staged.includes(change));
}

export const GIT_COMMANDS: Command[] = [
	{
		id: 'git.commit',
		title: 'Commit…',
		category: 'Git',
		icon: GitCommitHorizontal,
		run: () => {
			useLayoutStore.getState().showView('git');
			useCommitFocus.getState().request();
		},
	},
	{
		id: 'git.switchBranch',
		title: 'Switch / Create Branch…',
		category: 'Git',
		keywords: ['checkout'],
		icon: GitBranch,
		run: switchBranch,
	},
	{
		id: 'git.pull',
		title: 'Pull',
		category: 'Git',
		icon: ArrowDown,
		run: async () => {
			await runRemote('pull', { announce: true });
		},
	},
	{
		id: 'git.push',
		title: 'Push',
		category: 'Git',
		icon: ArrowUp,
		run: async () => {
			await runRemote('push', { announce: true });
		},
	},
	{
		id: 'git.sync',
		title: 'Sync (Pull then Push)',
		category: 'Git',
		icon: ArrowDownUp,
		run: async () => {
			// A failed pull (conflicts, divergence) must be resolved before anything is pushed.
			if (await runRemote('pull', { announce: true }))
				await runRemote('push', { announce: true });
		},
	},
	{ id: 'git.log', title: 'Show Recent Commits', category: 'Git', icon: History, run: showLog },
	{
		id: 'git.diffFile',
		title: 'Diff Active File',
		category: 'Git',
		icon: FileDiff,
		run: diffActiveFile,
	},
];
