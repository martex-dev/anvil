import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GitService } from './git-service';
import { makeTestRepo, type TestRepo } from './test-repo';

let repo: TestRepo;
beforeEach(() => {
	repo = makeTestRepo();
});
afterEach(() => repo.remove());

// Real git processes: each spawn costs ~0.5 s on CI runners.
describe('GitService changes', { timeout: 30_000 }, () => {
	it('initializes a repository in a plain folder, once', async () => {
		const plain = mkdtempSync(join(tmpdir(), 'anvil-plain-'));
		try {
			const git = new GitService(() => plain);
			expect((await git.status()).isRepo).toBe(false);
			await git.init();
			expect(await git.status()).toMatchObject({ isRepo: true, staged: [], unstaged: [] });
			await expect(git.init()).rejects.toMatchObject({ code: 'GIT_ALREADY_A_REPO' });
		} finally {
			rmSync(plain, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		}
	});

	it('discards unstaged edits back to the index and deletes untracked files', async () => {
		repo.write('a.txt', 'one\n');
		repo.write('b.txt', 'b\n');
		repo.commitAll('first');
		const git = new GitService(() => repo.dir);
		// Staged, then edited again: discarding keeps what is staged.
		repo.write('a.txt', 'staged\n');
		await git.stage(['a.txt']);
		repo.write('a.txt', 'unstaged\n');
		rmSync(join(repo.dir, 'b.txt'));
		repo.write('new file [1].txt', 'n\n');
		await git.discard(['a.txt', 'b.txt'], ['new file [1].txt']);
		expect(readFileSync(join(repo.dir, 'a.txt'), 'utf8')).toBe('staged\n');
		expect(readFileSync(join(repo.dir, 'b.txt'), 'utf8')).toBe('b\n');
		expect(existsSync(join(repo.dir, 'new file [1].txt'))).toBe(false);
		const status = await git.status();
		expect(status.unstaged).toEqual([]);
		expect(status.staged.map((c) => c.path)).toEqual(['a.txt']);
		await expect(git.discard(['../x.txt'], [])).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
	});

	it('amends the last commit with a new message and newly staged files', async () => {
		const git = new GitService(() => repo.dir);
		expect(await git.lastCommitMessage()).toBeNull();
		await expect(git.commit('x', true)).rejects.toMatchObject({ code: 'GIT_NOTHING_TO_AMEND' });
		repo.write('a.txt', 'a\n');
		await git.stage(['a.txt']);
		await git.commit('first\n\nbody line');
		expect(await git.lastCommitMessage()).toBe('first\n\nbody line');
		// Nothing staged: an amend still rewrites the message.
		await git.commit('first, reworded', true);
		repo.write('b.txt', 'b\n');
		await git.stage(['b.txt']);
		await git.commit('first, with b', true);
		expect(repo.run('log', '--format=%s').trim().split('\n')).toEqual(['first, with b']);
		expect(repo.run('show', '--name-only', '--format=').trim().split('\n')).toEqual([
			'a.txt',
			'b.txt',
		]);
	});

	it('finds conflict markers left in a conflicted file', async () => {
		repo.write('a.txt', 'base\n');
		repo.commitAll('base');
		repo.run('switch', '-q', '-c', 'other');
		repo.write('a.txt', 'theirs\n');
		repo.commitAll('theirs');
		repo.run('switch', '-q', 'main');
		repo.write('a.txt', 'ours\n');
		repo.write('clean.txt', 'no markers\n======= not a divider\n');
		repo.commitAll('ours');
		try {
			repo.run('merge', '-q', 'other');
		} catch {
			// Expected: the merge stops with a conflict in a.txt.
		}
		const git = new GitService(() => repo.dir);
		expect((await git.status()).unstaged).toEqual([
			{ path: 'a.txt', kind: 'conflicted', workspacePath: 'a.txt' },
		]);
		expect(await git.conflictMarkers(['a.txt', 'clean.txt', 'gone.txt'])).toEqual(['a.txt']);
		repo.write('a.txt', 'resolved\n');
		expect(await git.conflictMarkers(['a.txt'])).toEqual([]);
	});
});
