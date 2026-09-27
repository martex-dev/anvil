import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A throwaway repository for tests against the real system git. */
export interface TestRepo {
	dir: string;
	run: (...args: string[]) => string;
	write: (name: string, text: string) => void;
	/** Stages everything and commits it. */
	commitAll: (message: string) => void;
	remove: () => void;
}

export function makeTestRepo(prefix = 'anvil-git-'): TestRepo {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	const run = (...args: string[]): string =>
		execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
	run('init', '-q', '-b', 'main');
	run('config', 'user.email', 'test@anvil.local');
	run('config', 'user.name', 'Anvil Test');
	run('config', 'core.autocrlf', 'false');
	return {
		dir,
		run,
		write: (name, text) => writeFileSync(join(dir, name), text),
		commitAll: (message) => {
			run('add', '-A');
			run('commit', '-q', '-m', message);
		},
		// git.exe can hold the folder for a moment after exiting on Windows runners.
		remove: () =>
			rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
	};
}
