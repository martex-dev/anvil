import type { SimpleGit } from 'simple-git';

import { AnvilError } from '../../core/errors';
import { git, queued } from './git-process';

// Branches and everything that talks to a remote: pull, push, checkout.

const lines = (out: string): string[] =>
	out
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

export function pullSummary(s: { changes: number; insertions: number; deletions: number }): string {
	if (s.changes === 0) return 'Already up to date';
	const files = `${s.changes} file${s.changes === 1 ? '' : 's'}`;
	return `${files} changed, +${s.insertions} −${s.deletions}`;
}

async function remotes(g: SimpleGit): Promise<string[]> {
	return lines(await g.raw(['remote']));
}

/**
 * Rejects what git itself rejects, and nothing else: non-ASCII, `+` and `@` are all fine in
 * branch names. `--branch` also expands shorthands like `@{-1}`, so the name must come back
 * unchanged; a leading dash would be read as an option.
 */
export async function assertBranchName(g: SimpleGit, name: string): Promise<void> {
	const bad = (): AnvilError => new AnvilError('GIT_BAD_BRANCH', `Invalid branch name: ${name}`);
	if (name.startsWith('-')) throw bad();
	const checked = await g.raw(['check-ref-format', '--branch', name]).catch(() => {
		throw bad();
	});
	if (checked.trim() !== name) throw bad();
}

export async function pull(root: string): Promise<{ summary: string }> {
	// Pull fetches (remote refs) and merges (index and working tree): it holds both lanes.
	const r = await queued(root, 'remote', () =>
		queued(root, 'index', () => git(root, 'long').pull()),
	);
	return { summary: pullSummary(r.summary) };
}

/**
 * Where a branch without an upstream is published: the remote configured for it
 * (branch.<name>.remote, or remote.pushDefault), else the only remote, else origin.
 */
export async function publishRemote(g: SimpleGit, branch: string): Promise<string> {
	const names = await remotes(g);
	if (names.length === 0)
		throw new AnvilError(
			'GIT_NO_REMOTE',
			'This repository has no remote. Add one in a terminal: git remote add origin <url>',
		);
	const config = async (key: string): Promise<string> =>
		// `config --get` exits 1 when the key is unset, which is the normal case here.
		(await g.raw(['config', '--get', key]).catch(() => '')).trim();
	for (const configured of [
		await config(`branch.${branch}.pushRemote`),
		await config('remote.pushDefault'),
		await config(`branch.${branch}.remote`),
	]) {
		if (configured && names.includes(configured)) return configured;
	}
	if (names.length === 1 && names[0]) return names[0];
	if (names.includes('origin')) return 'origin';
	throw new AnvilError(
		'GIT_AMBIGUOUS_REMOTE',
		`Several remotes (${names.join(', ')}) and none is "origin". Publish once from a terminal: git push -u <remote> ${branch}`,
	);
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
		// First push of a new branch: publish it and set its upstream.
		const remote = await publishRemote(g, branch);
		await g.raw(['push', '-u', remote, branch]);
		return { summary: `Published ${branch} to ${remote}` };
	});
}

export async function branches(root: string): Promise<{ current: string | null; local: string[] }> {
	const b = await git(root).branchLocal();
	return { current: b.current || null, local: b.all };
}

export async function checkout(root: string, branch: string, create: boolean): Promise<void> {
	const g = git(root, 'write');
	await assertBranchName(g, branch);
	// `switch` (not `checkout`) can't mistake a branch for a file of the same name.
	await queued(root, 'index', () =>
		g.raw(create ? ['switch', '-c', branch] : ['switch', branch]),
	);
}
