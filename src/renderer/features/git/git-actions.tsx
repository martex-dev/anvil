import { Archive } from 'lucide-react';

import type { GitChange, GitStash } from '@shared/ipc/channels/git';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { discardPlan } from './change-rows';
import { confirmGit } from './git-confirm';
import { GIT_STATUS_KEY, gitOp } from './git-ops';

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

/** Stash key under the status key, so every status refresh also re-reads the stash list. */
export const GIT_STASHES_KEY = [...GIT_STATUS_KEY, 'stashes'] as const;

/** Asks for an optional message, then stashes everything (untracked files included). */
export async function stashChanges(): Promise<void> {
	const picked = await quickPick({
		title: 'stash',
		placeholder: 'Stash message (optional), then Enter',
		items: [
			{
				id: 'plain',
				label: 'Stash without a message',
				icon: <Archive size={13} />,
			},
		],
		allowCustom: { label: (text) => `Stash as "${text}"` },
	});
	if (!picked) return;
	const message = picked.startsWith('custom:') ? picked.slice(7).trim() : undefined;
	const done = await gitOp('Stash failed', async () => {
		await call('git:stash', message ? { message } : {});
		return true;
	});
	if (done) toast.success('Changes stashed', message ?? 'Untracked files included.');
}

const STASH_TEXT = {
	apply: { channel: 'git:stashApply', done: 'Stash applied', fail: 'Apply failed' },
	pop: { channel: 'git:stashPop', done: 'Stash popped', fail: 'Pop failed' },
	drop: { channel: 'git:stashDrop', done: 'Stash dropped', fail: 'Drop failed' },
} as const;

/** Applies, pops or (after asking) drops stash@{index}. */
export async function stashAction(
	action: 'apply' | 'pop' | 'drop',
	stash: Pick<GitStash, 'index' | 'message'>,
): Promise<void> {
	if (action === 'drop') {
		const ok = await confirmGit({
			title: 'Drop this stash?',
			description: `"${stash.message}" is deleted; its changes can't be brought back from Anvil.`,
			confirmLabel: 'Drop Stash',
			danger: true,
		});
		if (!ok) return;
	}
	const text = STASH_TEXT[action];
	const done = await gitOp(text.fail, async () => {
		await call(text.channel, { index: stash.index });
		return true;
	});
	if (done) toast.success(text.done, stash.message);
}

/** Palette: pick a stash, then apply, pop or drop it. */
export async function pickStash(action: 'apply' | 'pop' | 'drop'): Promise<void> {
	const stashes = call('git:stashList');
	const picked = await quickPick({
		title: 'stash',
		placeholder: `Stash to ${action}`,
		loadErrorTitle: 'Could not list stashes',
		items: stashes.then((list) =>
			list.map((s) => ({
				id: String(s.index),
				label: s.message,
				description: new Date(s.date).toLocaleString([], { hour12: false }),
				detail: `stash@{${s.index}}`,
				icon: <Archive size={13} />,
			})),
		),
	});
	if (picked === null) return;
	const stash = (await stashes).find((s) => String(s.index) === picked);
	if (stash) await stashAction(action, stash);
}

export async function initRepository(): Promise<void> {
	const done = await gitOp('Could not initialize the repository', async () => {
		await call('git:init');
		return true;
	});
	if (done) toast.success('Repository initialized', 'Changes in this folder are now tracked.');
}
