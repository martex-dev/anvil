import type { GitStash } from '@shared/ipc/channels/git';

import { AnvilError } from '../../core/errors';
import { git, queued } from './git-process';

/** Stashes every change, untracked files included: a quick "put this aside". */
export async function stash(root: string, message?: string): Promise<void> {
	const out = await queued(root, 'index', () =>
		git(root, 'write').raw([
			'stash',
			'push',
			'--include-untracked',
			...(message ? ['-m', message] : []),
		]),
	);
	// git exits 0 with this message when there is nothing to stash; not a success worth a toast.
	if (/no local changes to save/i.test(out))
		throw new AnvilError('GIT_NOTHING_TO_STASH', 'There are no changes to stash');
}

/** Newest first. `%gs` is the stash's own description ("On main: message"). */
export async function stashList(root: string): Promise<GitStash[]> {
	const out = await git(root).raw(['stash', 'list', '--format=%gd%x1f%gs%x1f%ct']);
	return out
		.split(/\r?\n/)
		.filter(Boolean)
		.flatMap((line) => {
			const [ref = '', message = '', time = '0'] = line.split('\x1f');
			const index = /^stash@\{(\d+)\}$/.exec(ref)?.[1];
			return index === undefined
				? []
				: [{ index: Number(index), message, date: Number(time) * 1000 }];
		});
}

/**
 * apply keeps the stash, pop drops it once it applied cleanly (a conflicting pop keeps it, as
 * git does), drop just deletes it.
 */
export async function stashCommand(
	root: string,
	action: 'apply' | 'pop' | 'drop',
	index: number,
): Promise<void> {
	await queued(root, 'index', () =>
		git(root, 'write').raw(['stash', action, '--quiet', `stash@{${index}}`]),
	);
}
