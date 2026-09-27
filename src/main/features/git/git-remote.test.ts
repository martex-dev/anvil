import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { formatGitError } from './git-errors';
import { git } from './git-process';
import { branches, checkout, fetchRemotes, publishRemote, push } from './git-remote';

// Integration tests against the real system git, with a bare repository as the remote.
let dir: string;
let repo: string;
const run = (cwd: string, ...args: string[]): string =>
	execFileSync('git', args, { cwd, encoding: 'utf8' });

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-remote-'));
	repo = join(dir, 'work');
	run(dir, 'init', '-q', '-b', 'main', 'work');
	run(repo, 'config', 'user.email', 'test@anvil.local');
	run(repo, 'config', 'user.name', 'Anvil Test');
	writeFileSync(join(repo, 'a.txt'), 'a\n');
	run(repo, 'add', 'a.txt');
	run(repo, 'commit', '-q', '-m', 'first');
});
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));

describe('branches and remotes', { timeout: 30_000 }, () => {
	it('accepts every branch name git accepts and rejects the rest', async () => {
		await checkout(repo, 'feature/ünïcode+x@1', true);
		expect((await branches(repo)).current).toBe('feature/ünïcode+x@1');
		for (const bad of ['a..b', '-x', 'x.lock', '@{-1}', 'with space']) {
			await expect(checkout(repo, bad, true), bad).rejects.toMatchObject({
				code: 'GIT_BAD_BRANCH',
			});
		}
	});

	it('publishes a new branch to the only remote, whatever it is called', async () => {
		run(dir, 'init', '-q', '--bare', 'remote.git');
		run(repo, 'remote', 'add', 'upstream', join(dir, 'remote.git'));
		await expect(push(repo)).resolves.toEqual({ summary: 'Published main to upstream' });
		expect(run(repo, 'rev-parse', '--abbrev-ref', 'main@{upstream}').trim()).toBe(
			'upstream/main',
		);
	});

	it('fetches every remote and prunes branches deleted there', async () => {
		await expect(fetchRemotes(repo, true)).resolves.toEqual({
			summary: 'This repository has no remotes',
		});
		run(dir, 'init', '-q', '--bare', 'remote.git');
		run(repo, 'remote', 'add', 'origin', join(dir, 'remote.git'));
		run(repo, 'push', '-q', 'origin', 'main', 'main:gone');
		run(repo, 'fetch', '-q', 'origin');
		run(join(dir, 'remote.git'), 'branch', '-D', 'gone');
		await expect(fetchRemotes(repo, true)).resolves.toEqual({ summary: 'Fetched origin' });
		const refs = run(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/remotes');
		expect(refs.split('\n').filter(Boolean)).toEqual(['origin/main']);
	});

	it('prefers the configured push remote, then origin, and explains when it cannot choose', async () => {
		const g = git(repo);
		await expect(publishRemote(g, 'main')).rejects.toMatchObject({ code: 'GIT_NO_REMOTE' });
		run(repo, 'remote', 'add', 'fork', 'https://example.invalid/fork.git');
		run(repo, 'remote', 'add', 'mirror', 'https://example.invalid/mirror.git');
		await expect(publishRemote(g, 'main')).rejects.toMatchObject({
			code: 'GIT_AMBIGUOUS_REMOTE',
		});
		run(repo, 'remote', 'add', 'origin', 'https://example.invalid/origin.git');
		expect(await publishRemote(g, 'main')).toBe('origin');
		run(repo, 'config', 'remote.pushDefault', 'fork');
		expect(await publishRemote(g, 'main')).toBe('fork');
	});
});

describe('formatGitError', () => {
	it('keeps actionable hints after the error, drops boilerplate and masks tokens', () => {
		const raw = [
			'To https://marto:ghp_secret@github.com/x/y.git',
			' ! [rejected]        main -> main (fetch first)',
			"error: failed to push some refs to 'https://marto:ghp_secret@github.com/x/y.git'",
			'hint: Updates were rejected because the remote contains work that you do not',
			'hint: have locally. Integrate the remote changes (e.g.',
			"hint: 'git pull ...') before pushing again.",
			"hint: See the 'Note about fast-forwards' in 'git push --help' for details.",
			'hint: Disable this message with "git config advice.pushRejected false"',
		].join('\n');
		const text = formatGitError(raw);
		expect(text).not.toContain('ghp_secret');
		expect(text).toContain('https://***@github.com/x/y.git');
		expect(text.split('\n\n')[1]).toBe(
			[
				'Updates were rejected because the remote contains work that you do not',
				'have locally. Integrate the remote changes (e.g.',
				"'git pull ...') before pushing again.",
				"See the 'Note about fast-forwards' in 'git push --help' for details.",
			].join('\n'),
		);
	});
});
