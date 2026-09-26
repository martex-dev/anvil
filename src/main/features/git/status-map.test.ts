import { describe, expect, it } from 'vitest';

import { mapStatus, type PorcelainFile } from './status-map';

const f = (path: string, index: string, working_dir: string, from?: string): PorcelainFile => ({
	path,
	index,
	working_dir,
	...(from ? { from } : {}),
});

describe('mapStatus', () => {
	const map = (files: PorcelainFile[]) => mapStatus(files, (p) => p);

	it('splits staged and unstaged changes', () => {
		const { staged, unstaged } = map([
			f('a.ts', 'M', ' '),
			f('b.ts', ' ', 'M'),
			f('c.ts', 'A', ' '),
			f('d.ts', ' ', 'D'),
		]);
		expect(staged.map((c) => `${c.path}:${c.kind}`)).toEqual(['a.ts:modified', 'c.ts:added']);
		expect(unstaged.map((c) => `${c.path}:${c.kind}`)).toEqual([
			'b.ts:modified',
			'd.ts:deleted',
		]);
	});

	it('lists a file that is staged and modified again in both lists', () => {
		const { staged, unstaged } = map([f('x.ts', 'M', 'M')]);
		expect(staged).toHaveLength(1);
		expect(unstaged).toHaveLength(1);
	});

	it('handles untracked, renames and conflicts', () => {
		const { staged, unstaged } = map([
			f('new.ts', '?', '?'),
			f('b.ts', 'R', ' ', 'a.ts'),
			f('clash.ts', 'U', 'U'),
		]);
		expect(unstaged).toEqual([
			{ path: 'clash.ts', kind: 'conflicted', workspacePath: 'clash.ts' },
			{ path: 'new.ts', kind: 'untracked', workspacePath: 'new.ts' },
		]);
		expect(staged).toEqual([
			{ path: 'b.ts', from: 'a.ts', kind: 'renamed', workspacePath: 'b.ts' },
		]);
	});

	it('maps paths to the open folder when the repo root is above it', () => {
		const { unstaged } = mapStatus(
			[f('app/src/a.ts', ' ', 'M'), f('README.md', ' ', 'M')],
			(p) => (p.startsWith('app/') ? p.slice(4) : null),
		);
		// Sorted by repo path: app/src/a.ts, README.md.
		expect(unstaged.map((c) => c.workspacePath)).toEqual(['src/a.ts', null]);
	});
});
