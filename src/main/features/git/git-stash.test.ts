import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { stash, stashCommand, stashList } from './git-stash';
import { makeTestRepo, type TestRepo } from './test-repo';

let repo: TestRepo;
beforeEach(() => {
	repo = makeTestRepo();
	repo.write('a.txt', 'a\n');
	repo.commitAll('first');
});
afterEach(() => repo.remove());

describe('stash', { timeout: 30_000 }, () => {
	it('stashes edits and untracked files with a message, lists, applies, pops and drops', async () => {
		await expect(stash(repo.dir)).rejects.toMatchObject({ code: 'GIT_NOTHING_TO_STASH' });
		repo.write('a.txt', 'edited\n');
		repo.write('new.txt', 'new\n');
		await stash(repo.dir, 'wip: features');
		expect(readFileSync(join(repo.dir, 'a.txt'), 'utf8')).toBe('a\n');
		expect(existsSync(join(repo.dir, 'new.txt'))).toBe(false);
		repo.write('a.txt', 'second\n');
		await stash(repo.dir);

		const list = await stashList(repo.dir);
		expect(list.map((s) => [s.index, s.message])).toEqual([
			[0, expect.stringMatching(/^WIP on main: /) as unknown as string],
			[1, 'On main: wip: features'],
		]);
		expect(list[0]?.date).toBeGreaterThan(0);

		await stashCommand(repo.dir, 'drop', 0);
		await stashCommand(repo.dir, 'apply', 0);
		expect(readFileSync(join(repo.dir, 'new.txt'), 'utf8')).toBe('new\n');
		expect(await stashList(repo.dir)).toHaveLength(1);
		repo.run('checkout', '--', 'a.txt');
		repo.run('clean', '-fq');
		await stashCommand(repo.dir, 'pop', 0);
		expect(readFileSync(join(repo.dir, 'a.txt'), 'utf8')).toBe('edited\n');
		expect(await stashList(repo.dir)).toEqual([]);
	});
});
