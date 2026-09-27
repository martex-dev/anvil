import { Cloud, GitBranch } from 'lucide-react';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { type PickItem, quickPick } from '../../ui/QuickPick';
import { confirmGit } from './git-confirm';
import { gitOp } from './git-ops';

const REMOTE = 'remote:';
const CUSTOM = 'custom:';

/**
 * Items for the branch switcher: local branches, then remote branches that have no local branch
 * of the same name yet (picking one creates a local branch tracking it).
 */
export function branchItems(b: {
	current: string | null;
	local: string[];
	remote: string[];
}): PickItem[] {
	const local = new Set(b.local);
	const localItems = b.local.map((name) => ({
		id: name,
		label: name,
		current: name === b.current,
		icon: <GitBranch size={13} />,
	}));
	const remoteItems = b.remote
		// "origin/feature" is already here as "feature" when that local branch exists.
		.filter((name) => !local.has(name.slice(name.indexOf('/') + 1)))
		.map((name) => ({
			id: `${REMOTE}${name}`,
			label: name,
			description: 'remote: check out as a local tracking branch',
			icon: <Cloud size={13} />,
		}));
	return [...localItems, ...remoteItems];
}

/** Switch to a local or remote branch, or type a new name to create one. */
export async function switchBranch(): Promise<void> {
	const picked = await quickPick({
		title: 'branch',
		placeholder: 'Switch to a branch, or type a new name to create it',
		loadErrorTitle: 'Could not list branches',
		items: call('git:branches').then(branchItems),
		allowCustom: { label: (text) => `Create branch "${text}" and switch to it` },
	});
	if (!picked) return;
	const create = picked.startsWith(CUSTOM);
	const remote = picked.startsWith(REMOTE);
	const branch = create
		? picked.slice(CUSTOM.length)
		: remote
			? picked.slice(REMOTE.length)
			: picked;
	const result = await gitOp('Checkout failed', () =>
		call('git:checkout', { branch, create, ...(remote ? { remote } : {}) }),
	);
	if (!result) return;
	toast.success(
		create ? 'Branch created' : remote ? 'Tracking branch checked out' : 'Switched branch',
		remote ? `${result.branch} ← ${branch}` : result.branch,
	);
}

/** Delete a local branch; an unmerged one is only deleted after a second, explicit yes. */
export async function deleteBranch(): Promise<void> {
	const branches = call('git:branches');
	const picked = await quickPick({
		title: 'branch',
		placeholder: 'Branch to delete',
		loadErrorTitle: 'Could not list branches',
		items: branches.then((b) =>
			b.local
				.filter((name) => name !== b.current)
				.map((name) => ({ id: name, label: name, icon: <GitBranch size={13} /> })),
		),
	});
	if (!picked) return;
	const tryDelete = async (force: boolean): Promise<'done' | 'unmerged' | 'failed'> => {
		try {
			await call('git:deleteBranch', { branch: picked, force });
			return 'done';
		} catch (error) {
			const code = (error as { code?: string }).code;
			if (!force && code === 'GIT_BRANCH_NOT_MERGED') return 'unmerged';
			throw error;
		}
	};
	let outcome = await gitOp('Could not delete the branch', () => tryDelete(false));
	if (outcome === 'unmerged') {
		const ok = await confirmGit({
			title: `Delete unmerged branch ${picked}?`,
			description: `${picked} has commits that are not merged into any other branch. Deleting it loses them.`,
			confirmLabel: 'Delete Anyway',
			danger: true,
		});
		if (!ok) return;
		outcome = await gitOp('Could not delete the branch', () => tryDelete(true));
	}
	if (outcome === 'done') toast.success('Branch deleted', picked);
}
