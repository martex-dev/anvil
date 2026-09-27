import { AnvilError } from '../../core/errors';
import { git, queued } from './git-process';

// Branches and everything that talks to a remote: pull, push, checkout.

export function pullSummary(s: { changes: number; insertions: number; deletions: number }): string {
	if (s.changes === 0) return 'Already up to date';
	const files = `${s.changes} file${s.changes === 1 ? '' : 's'}`;
	return `${files} changed, +${s.insertions} −${s.deletions}`;
}

export async function pull(root: string): Promise<{ summary: string }> {
	// Pull fetches (remote refs) and merges (index and working tree): it holds both lanes.
	const r = await queued(root, 'remote', () =>
		queued(root, 'index', () => git(root, 'long').pull()),
	);
	return { summary: pullSummary(r.summary) };
}

export async function push(root: string): Promise<{ summary: string }> {
	const s = await git(root).status();
	if (!s.current || s.detached)
		throw new AnvilError('GIT_DETACHED', 'Check out a branch before pushing');
	const branch = s.current;
	return queued(root, 'remote', async () => {
		const g = git(root, 'long');
		if (s.tracking) {
			await g.push();
			return { summary: `Pushed ${branch} → ${s.tracking}` };
		}
		// First push of a new branch: publish it and set upstream.
		await g.push(['-u', 'origin', branch]);
		return { summary: `Published ${branch} to origin` };
	});
}

export async function branches(root: string): Promise<{ current: string | null; local: string[] }> {
	const b = await git(root).branchLocal();
	return { current: b.current || null, local: b.all };
}

export async function checkout(root: string, branch: string, create: boolean): Promise<void> {
	if (!/^[\w./-]+$/.test(branch) || branch.startsWith('-'))
		throw new AnvilError('GIT_BAD_BRANCH', `Invalid branch name: ${branch}`);
	const g = git(root, 'write');
	await queued(root, 'index', () =>
		create ? g.checkoutLocalBranch(branch) : g.checkout(branch).then(() => undefined),
	);
}
