import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { batchPaths, gitEnv } from './git-process';
import { GitService } from './git-service';

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
		writeFileSync(join(repo, 'root.md'), 'y');
		const status = await new GitService(() => join(repo, 'app')).status();
		const byPath = Object.fromEntries(status.unstaged.map((c) => [c.path, c.workspacePath]));
		expect(byPath).toEqual({ 'app/b.ts': 'b.ts', 'root.md': null });
	});

	it('blames and reads HEAD by workspace path when the open folder is a subfolder', async () => {
		mkdirSync(join(repo, 'app'));
		writeFileSync(join(repo, 'app', 'b.ts'), 'sub\n');
		// Same name at the repo root: must not be picked instead.
		writeFileSync(join(repo, 'b.ts'), 'root\n');
		run('add', '.');
		run('commit', '-q', '-m', 'files');
		const git = new GitService(() => join(repo, 'app'));
		expect(await git.headContent('b.ts')).toBe('sub\n');
		const blame = await git.blame('b.ts', 1);
		expect(blame).toMatchObject({ author: 'Anvil Test', summary: 'files' });
		await expect(git.headContent('../b.ts')).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
	});

	it('keeps git messages untranslated but preserves the character set', () => {
		expect(
			gitEnv({
				LANG: 'de_DE.UTF-8',
				LANGUAGE: 'de',
				LC_ALL: 'de_DE.UTF-8',
				LC_MESSAGES: 'de_DE.UTF-8',
			}),
		).toEqual({
			LANG: 'de_DE.UTF-8',
			LC_CTYPE: 'de_DE.UTF-8',
			LC_MESSAGES: 'C',
			GIT_TERMINAL_PROMPT: '0',
		});
	});

	it('stages and unstages many files across several command lines', async () => {
		const git = new GitService(() => repo);
		writeFileSync(join(repo, 'first.txt'), 'x');
		run('add', 'first.txt');
		run('commit', '-q', '-m', 'first');
		const paths = Array.from({ length: 800 }, (_, i) => `research-file-${i}.txt`);
		for (const p of paths) writeFileSync(join(repo, p), p);
		expect(batchPaths(paths).length).toBeGreaterThan(1);
		await git.stage(paths);
		expect((await git.status()).staged).toHaveLength(800);
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

	it('passes git only an allowlisted environment', () => {
		const env = gitEnv({
			Path: 'C:/bin',
			USERPROFILE: 'C:/Users/marto',
			GCM_INTERACTIVE: 'auto',
			GIT_SSH: 'C:/Program Files/PuTTY/plink.exe',
			GIT_SSH_COMMAND: 'ssh -i ~/.ssh/work',
			XDG_CONFIG_HOME: '/home/marto/.config',
			GIT_ASKPASS: 'C:/other-app/askpass.exe',
			VSCODE_GIT_IPC_HANDLE: 'pipe',
			EDITOR: 'code --wait',
			SOME_SECRET_TOKEN: 'nope',
		});
		expect(env).toEqual({
			Path: 'C:/bin',
			USERPROFILE: 'C:/Users/marto',
			GCM_INTERACTIVE: 'auto',
			GIT_SSH: 'C:/Program Files/PuTTY/plink.exe',
			GIT_SSH_COMMAND: 'ssh -i ~/.ssh/work',
			XDG_CONFIG_HOME: '/home/marto/.config',
			LC_MESSAGES: 'C',
			GIT_TERMINAL_PROMPT: '0',
		});
	});
});
