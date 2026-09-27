import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { log, show } from './git-history';
import { makeTestRepo, type TestRepo } from './test-repo';

let repo: TestRepo;
beforeEach(() => {
	repo = makeTestRepo();
});
afterEach(() => repo.remove());

describe('file history', { timeout: 30_000 }, () => {
	it('follows a file across a rename and shows each version and its parent', async () => {
		expect(await log(repo.dir, 10, 'b.txt')).toEqual([]);
		repo.write('a.txt', 'one\n');
		repo.write('other.txt', 'x\n');
		repo.commitAll('add a');
		repo.run('mv', 'a.txt', 'b.txt');
		repo.commitAll('rename to b');
		repo.write('other.txt', 'y\n');
		repo.commitAll('unrelated');
		repo.write('b.txt', 'one\ntwo\n');
		repo.commitAll('edit b');

		const history = await log(repo.dir, 10, 'b.txt');
		expect(history.map((c) => [c.message, c.path, c.from])).toEqual([
			['edit b', 'b.txt', undefined],
			['rename to b', 'b.txt', 'a.txt'],
			['add a', 'a.txt', undefined],
		]);
		expect(history[0]?.hash).toMatch(/^[0-9a-f]{40}$/);
		expect((await log(repo.dir, 10)).map((c) => c.message)).toEqual([
			'edit b',
			'unrelated',
			'rename to b',
			'add a',
		]);

		const [edit, , add] = history;
		expect(await show(repo.dir, edit?.hash ?? '', 'b.txt')).toEqual({
			content: 'one\ntwo\n',
			binary: false,
		});
		expect(await show(repo.dir, edit?.hash ?? '', 'b.txt', true)).toEqual({
			content: 'one\n',
			binary: false,
		});
		// The first commit has no parent: that side is empty, not an error.
		expect(await show(repo.dir, add?.hash ?? '', 'a.txt', true)).toEqual({
			content: null,
			binary: false,
		});
	});
});
