import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { git, queued } from './git-process';

describe('queued', () => {
	it('runs one repository lane at a time, and a failure does not block the next op', async () => {
		const order: string[] = [];
		const step =
			(name: string, fail = false) =>
			async (): Promise<string> => {
				order.push(`start ${name}`);
				await new Promise((r) => setTimeout(r, 20));
				order.push(`end ${name}`);
				if (fail) throw new Error(name);
				return name;
			};
		const a = queued('C:/Repo', 'index', step('a', true));
		// Same repository with different casing on Windows: still the same lane there.
		const root2 = process.platform === 'win32' ? 'c:/repo' : 'C:/Repo';
		const b = queued(root2, 'index', step('b'));
		await expect(a).rejects.toThrow('a');
		await expect(b).resolves.toBe('b');
		expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
	});

	it('lets the remote lane run beside the index lane', async () => {
		const order: string[] = [];
		let release = (): void => undefined;
		const push = queued('/r', 'remote', async () => {
			order.push('push');
			await new Promise<void>((r) => {
				release = r;
			});
		});
		await queued('/r', 'index', async () => {
			order.push('stage');
		});
		release();
		await push;
		expect(order).toEqual(['push', 'stage']);
	});
});

describe('git', { timeout: 30_000 }, () => {
	let dir: string | null = null;
	afterEach(() => {
		vi.unstubAllEnvs();
		if (dir) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		dir = null;
	});

	it('runs with the user’s ssh command and global config set (simple-git blocks them by default)', async () => {
		dir = mkdtempSync(join(tmpdir(), 'anvil-git-env-'));
		execFileSync('git', ['init', '-q'], { cwd: dir });
		vi.stubEnv('GIT_SSH_COMMAND', 'ssh -o BatchMode=yes');
		vi.stubEnv('GIT_SSH', 'ssh');
		const status = await git(dir).status();
		expect(status.isClean()).toBe(true);
	});
});
