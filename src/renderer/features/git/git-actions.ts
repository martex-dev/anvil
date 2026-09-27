import type { GitChange } from '@shared/ipc/channels/git';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { discardPlan } from './change-rows';
import { confirmGit } from './git-confirm';
import { gitOp } from './git-ops';

// Source Control operations shared by the Git view and the palette. Each runs through gitOp:
// busy while it runs, a toast when it fails, a fresh status afterwards.

const fileName = (path: string): string => path.split('/').at(-1) ?? path;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Discards unstaged changes after asking; untracked files are deleted, so that is spelled out. */
export async function discardChanges(changes: readonly GitChange[]): Promise<void> {
	const { tracked, untracked } = discardPlan(changes);
	const total = tracked.length + untracked.length;
	if (total === 0) {
		toast.info('Nothing to discard', 'Conflicted files are resolved by editing and staging.');
		return;
	}
	const single = total === 1 ? fileName(tracked[0] ?? untracked[0] ?? '') : null;
	const deletes =
		untracked.length === 0
			? ''
			: untracked.length === total
				? ` ${single ? 'It is' : 'They are'} untracked and will be deleted; git can't bring ${single ? 'it' : 'them'} back.`
				: ` ${plural(untracked.length, 'untracked file')} will be deleted; git can't bring them back.`;
	const ok = await confirmGit({
		title: single
			? `Discard changes in ${single}?`
			: `Discard changes in ${plural(total, 'file')}?`,
		description: `Unstaged edits are lost; anything staged is kept.${deletes}`,
		confirmLabel: single ? 'Discard' : `Discard ${plural(total, 'File')}`,
		danger: true,
	});
	if (!ok) return;
	await gitOp('Discard failed', () => call('git:discard', { tracked, untracked }));
}

export async function initRepository(): Promise<void> {
	const done = await gitOp('Could not initialize the repository', async () => {
		await call('git:init');
		return true;
	});
	if (done) toast.success('Repository initialized', 'Changes in this folder are now tracked.');
}
