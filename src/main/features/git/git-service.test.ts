import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gitEnv, GitService } from './git-service';

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

	it('passes git only an allowlisted environment', () => {
		const env = gitEnv({
			Path: 'C:/bin',
			USERPROFILE: 'C:/Users/marto',
			GCM_INTERACTIVE: 'auto',
			GIT_ASKPASS: 'C:/other-app/askpass.exe',
			VSCODE_GIT_IPC_HANDLE: 'pipe',
			EDITOR: 'code --wait',
			SOME_SECRET_TOKEN: 'nope',
		});
		expect(env).toEqual({
			Path: 'C:/bin',
			USERPROFILE: 'C:/Users/marto',
			GCM_INTERACTIVE: 'auto',
			GIT_TERMINAL_PROMPT: '0',
		});
	});
});
