import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitDiff } from './git-diff';

const dirs: string[] = [];
function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'anvil-diff-'));
	dirs.push(dir);
	return dir;
}
const git = (root: string, ...args: string[]): void => {
	execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
};

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('gitDiff', () => {
	it('diffs against the empty tree before the first commit', async () => {
		const root = tempDir();
		git(root, 'init', '-q');
		writeFileSync(join(root, 'a.py'), 'x = 1\n');
		git(root, 'add', 'a.py');
		const { diff } = await gitDiff(root, false);
		expect(diff).toContain('+x = 1');
		expect((await gitDiff(root, true)).diff).toContain('+x = 1');
	});

	it('fails with a readable reason outside a repository', async () => {
		const root = tempDir();
		await expect(gitDiff(root, false)).rejects.toMatchObject({
			code: 'AI_GIT_DIFF_FAILED',
			message: 'This folder is not a git repository.',
		});
		await expect(gitDiff(root, true)).rejects.toMatchObject({ code: 'AI_GIT_DIFF_FAILED' });
	});
});
