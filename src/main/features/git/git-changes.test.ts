import { mkdtempSync, rmSync } from 'node:fs';
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
