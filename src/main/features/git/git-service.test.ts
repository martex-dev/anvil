import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { blame, headContent, log } from './git-history';
import { batchPaths, isMissingPathError } from './git-process';
import { pullSummary } from './git-remote';
import { GitService } from './git-service';

// How the git:headContent / git:blame handlers resolve an editor path.
const headOf = async (git: GitService, path: string): Promise<string | null> => {
	const at = await git.locate(path);
	return at ? headContent(at.root, at.repoPath) : null;
};
const blameOf = async (git: GitService, path: string, line: number) => {
	const at = await git.locate(path);
	return at ? blame(at.root, at.repoPath, line) : null;
};

// Integration test against the real system git in a throwaway repository.
let repo: string;
const run = (...args: string[]): string =>
	execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

beforeEach(() => {
	repo = mkdtempSync(join(tmpdir(), 'anvil-git-'));
	run('init', '-q', '-b', 'main');
	run('config', 'user.email', 'test@anvil.local');
	run('config', 'user.name', 'Anvil Test');
	run('config', 'core.autocrlf', 'false');
});
// git.exe can hold the folder for a moment after exiting on Windows runners.
afterEach(() => rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));

// Real git processes: each spawn costs ~0.5 s on CI runners, so 5 s is too tight.
describe('GitService', { timeout: 30_000 }, () => {
	it('reports "not a repo" for plain folders', async () => {
		const plain = mkdtempSync(join(tmpdir(), 'anvil-plain-'));
		try {
			const status = await new GitService(() => plain).status();
			expect(status.isRepo).toBe(false);
		} finally {
			rmSync(plain, { recursive: true, force: true });
		}
	});

	it('notices `git init` and a deleted .git without a folder switch', async () => {
		const plain = mkdtempSync(join(tmpdir(), 'anvil-plain-'));
		try {
			const git = new GitService(() => plain);
			expect((await git.status()).isRepo).toBe(false);
			execFileSync('git', ['init', '-q'], { cwd: plain });
			expect((await git.status()).isRepo).toBe(true);
			rmSync(join(plain, '.git'), { recursive: true, force: true });
			expect((await git.status()).isRepo).toBe(false);
		} finally {
			rmSync(plain, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		}
	});

	it('stages, commits, and diffs working-tree changes', async () => {
		const git = new GitService(() => repo);
		writeFileSync(join(repo, 'a.txt'), 'one\n');

		let status = await git.status();
		expect(status).toMatchObject({ isRepo: true, branch: 'main' });
		expect(status.unstaged).toEqual([
			{ path: 'a.txt', kind: 'untracked', workspacePath: 'a.txt' },
		]);

		await git.stage(['a.txt']);
		status = await git.status();
		expect(status.staged.map((c) => `${c.path}:${c.kind}`)).toEqual(['a.txt:added']);

		const { hash } = await git.commit('first');
		expect(hash).toMatch(/^[0-9a-f]+$/);

		writeFileSync(join(repo, 'a.txt'), 'one\ntwo\n');
		const diff = await git.diff('a.txt', false);
		expect(diff).toEqual({ original: 'one\n', modified: 'one\ntwo\n', binary: false });

		await git.stage(['a.txt']);
		expect(await git.diff('a.txt', true)).toMatchObject({
			original: 'one\n',
			modified: 'one\ntwo\n',
		});
		await git.unstage(['a.txt']);
		status = await git.status();
		expect(status.staged).toEqual([]);
		expect(status.unstaged.map((c) => c.kind)).toEqual(['modified']);
	});

	it('diffs a staged rename against the old path', async () => {
		const git = new GitService(() => repo);
		writeFileSync(join(repo, 'old.txt'), 'same\n');
		await git.stage(['old.txt']);
		await git.commit('add old');
		run('mv', 'old.txt', 'new.txt');
		const status = await git.status();
		expect(status.staged).toEqual([
			{ path: 'new.txt', from: 'old.txt', kind: 'renamed', workspacePath: 'new.txt' },
		]);
		expect(await git.diff('new.txt', true, 'old.txt')).toMatchObject({
			original: 'same\n',
			modified: 'same\n',
		});
	});

	it('fully unstages a rename when given both paths', async () => {
		const git = new GitService(() => repo);
		writeFileSync(join(repo, 'old.txt'), 'same\n');
		await git.stage(['old.txt']);
		await git.commit('add old');
		run('mv', 'old.txt', 'new.txt');
		await git.unstage(['new.txt', 'old.txt']);
		const status = await git.status();
		expect(status.staged).toEqual([]);
		expect(status.unstaged.map((c) => `${c.path}:${c.kind}`).sort()).toEqual([
			'new.txt:untracked',
			'old.txt:deleted',
		]);
	});

	it('unstages before the first commit, keeping the file on disk', async () => {
		const git = new GitService(() => repo);
		mkdirSync(join(repo, 'src'));
		writeFileSync(join(repo, 'a.txt'), 'a\n');
		writeFileSync(join(repo, 'src', 'b.py'), 'b\n');
		await git.stage(['a.txt', 'src/b.py']);
		// Edited after staging: the index and the working tree now differ.
		writeFileSync(join(repo, 'a.txt'), 'a2\n');
		await git.unstage(['a.txt', 'src']);
		const status = await git.status();
		expect(status.staged).toEqual([]);
		expect(status.unstaged.map((c) => `${c.path}:${c.kind}`)).toEqual([
			'a.txt:untracked',
			'src/b.py:untracked',
		]);
		expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('a2\n');
	});

	it('refuses to commit with nothing staged and rejects paths outside the repo', async () => {
		const git = new GitService(() => repo);
		await expect(git.commit('empty')).rejects.toMatchObject({ code: 'GIT_NOTHING_STAGED' });
		await expect(git.stage(['../outside.txt'])).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
	});

	it('maps paths when the open folder is a subfolder of the repo', async () => {
		mkdirSync(join(repo, 'app'));
		writeFileSync(join(repo, 'app', 'b.ts'), 'x');
		writeFileSync(join(repo, 'app', '..env.bak'), 'z');
		writeFileSync(join(repo, 'root.md'), 'y');
		const status = await new GitService(() => join(repo, 'app')).status();
		const byPath = Object.fromEntries(status.unstaged.map((c) => [c.path, c.workspacePath]));
		expect(byPath).toEqual({
			'app/..env.bak': '..env.bak',
			'app/b.ts': 'b.ts',
			'root.md': null,
		});
	});

	it('blames and reads HEAD by workspace path when the open folder is a subfolder', async () => {
		mkdirSync(join(repo, 'app'));
		writeFileSync(join(repo, 'app', 'b.ts'), 'sub\n');
		// Same name at the repo root: must not be picked instead.
		writeFileSync(join(repo, 'b.ts'), 'root\n');
		run('add', '.');
		run('commit', '-q', '-m', 'files');
		const git = new GitService(() => join(repo, 'app'));
		expect(await headOf(git, 'b.ts')).toBe('sub\n');
		const blame = await blameOf(git, 'b.ts', 1);
		expect(blame).toMatchObject({ author: 'Anvil Test', summary: 'files' });
		await expect(headOf(git, '../b.ts')).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
	});

	it('stages and unstages many files across several command lines', async () => {
		const git = new GitService(() => repo);
		writeFileSync(join(repo, 'first.txt'), 'x');
		run('add', 'first.txt');
		run('commit', '-q', '-m', 'first');
		// Long names cross the command-line budget with few files: 800 short ones made real git on
		// Windows runners take over 30 s.
		const paths = Array.from(
			{ length: 200 },
			(_, i) => `research-notes-with-a-rather-long-descriptive-name-${i}.txt`,
		);
		for (const p of paths) writeFileSync(join(repo, p), p);
		expect(batchPaths(paths).length).toBeGreaterThan(1);
		await git.stage(paths);
		expect((await git.status()).staged).toHaveLength(200);
		await git.unstage(paths);
		expect((await git.status()).staged).toEqual([]);
	});

	it('batches paths under the command-line budget without dropping any', () => {
		const paths = Array.from({ length: 1000 }, (_, i) => `some/long/folder/name/file-${i}.py`);
		const batches = batchPaths(paths, 8_000);
		expect(batches.length).toBeGreaterThan(1);
		expect(batches.flat()).toEqual(paths);
		for (const b of batches) expect(b.join(' ').length).toBeLessThanOrEqual(8_000);
		expect(batchPaths([])).toEqual([]);
		// A single path longer than the budget still gets its own batch.
		expect(batchPaths(['x'.repeat(50)], 10)).toEqual([['x'.repeat(50)]]);
	});

	it('treats a missing side as empty but surfaces real git failures', async () => {
		const git = new GitService(() => repo);
		// No commits yet: HEAD does not resolve.
		writeFileSync(join(repo, 'new.txt'), 'n\n');
		await git.stage(['new.txt']);
		expect(await git.diff('new.txt', true)).toMatchObject({ original: '', modified: 'n\n' });
		expect(await headOf(git, 'new.txt')).toBeNull();
		expect(await blameOf(git, 'new.txt', 1)).toBeNull();
		await git.commit('first');
		writeFileSync(join(repo, 'untracked.txt'), 'u\n');
		expect(await headOf(git, 'untracked.txt')).toBeNull();
		expect(await blameOf(git, 'untracked.txt', 1)).toBeNull();
		expect(await blameOf(git, 'new.txt', 5)).toBeNull();

		expect(isMissingPathError(new Error("fatal: path 'a' does not exist in 'HEAD'"))).toBe(
			true,
		);
		expect(isMissingPathError(new Error('spawn git ENOENT'))).toBe(false);
		expect(isMissingPathError(new Error('fatal: bad object HEAD'))).toBe(false);
	});

	it('lists no commits for an unborn branch but reports other log failures', async () => {
		const git = new GitService(() => repo);
		expect(await log(repo, 10)).toEqual([]);
		writeFileSync(join(repo, 'a.txt'), 'a\n');
		await git.stage(['a.txt']);
		await git.commit('first');
		expect((await log(repo, 10)).map((c) => c.message)).toEqual(['first']);

		// Not an empty history: a failure (here, a folder that isn't there) is reported.
		await expect(log(join(repo, 'missing'), 10)).rejects.toThrow();
	});

	it('summarizes a pull without claiming changes that did not happen', () => {
		expect(pullSummary({ changes: 0, insertions: 0, deletions: 0 })).toBe('Already up to date');
		expect(pullSummary({ changes: 1, insertions: 2, deletions: 0 })).toBe(
			'1 file changed, +2 −0',
		);
		expect(pullSummary({ changes: 3, insertions: 5, deletions: 4 })).toBe(
			'3 files changed, +5 −4',
		);
	});
});
