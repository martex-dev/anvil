import { describe, expect, it } from 'vitest';

import type { FsEntry } from '@shared/ipc/channels/fs';

import {
	ancestorsOf,
	buildRows,
	type DirState,
	isFolder,
	joinPath,
	neighbourAfterRemoval,
	newNameProblem,
	parentOf,
	siblingNames,
} from './tree-model';

const e = (path: string, kind: FsEntry['kind'] = 'file'): FsEntry => ({
	name: path.split('/').at(-1) ?? path,
	path,
	kind,
	size: 0,
	mtimeMs: 0,
});

describe('buildRows', () => {
	const dirs = new Map<string, DirState>([
		['', { entries: [e('src', 'dir'), e('docs', 'dir'), e('README.md')] }],
		['src', { entries: [e('src/main', 'dir'), e('src/index.ts')] }],
	]);

	it('shows only the root when nothing is expanded', () => {
		const rows = buildRows(dirs, new Set());
		expect(rows.map((r) => (r.kind === 'entry' ? r.entry.path : r.kind))).toEqual([
			'src',
			'docs',
			'README.md',
		]);
	});

	it('nests expanded folders and shows loading for unfetched ones', () => {
		const rows = buildRows(dirs, new Set(['src', 'src/main', 'docs']));
		expect(rows.map((r) => `${r.depth}:${r.kind === 'entry' ? r.entry.path : r.kind}`)).toEqual(
			[
				'0:src',
				'1:src/main',
				'2:loading',
				'1:src/index.ts',
				'0:docs',
				'1:loading',
				'0:README.md',
			],
		);
	});

	it('shows an error row for a folder that failed to list', () => {
		const withError = new Map(dirs).set('docs', { error: 'Access denied' });
		const rows = buildRows(withError, new Set(['docs']));
		expect(rows.find((r) => r.kind === 'error')).toMatchObject({ dir: 'docs', depth: 1 });
	});

	it('inserts the new-file input at the top of its folder', () => {
		const rows = buildRows(dirs, new Set(['src']), { parent: 'src', kind: 'file' });
		expect(rows[1]).toMatchObject({ kind: 'input', parent: 'src', depth: 1, create: 'file' });
	});
});

describe('path helpers', () => {
	it('parentOf / ancestorsOf / joinPath', () => {
		expect(parentOf('src/main/index.ts')).toBe('src/main');
		expect(parentOf('README.md')).toBe('');
		expect(ancestorsOf('src/main/index.ts')).toEqual(['src', 'src/main']);
		expect(ancestorsOf('README.md')).toEqual([]);
		expect(joinPath('', 'a.ts')).toBe('a.ts');
		expect(joinPath('src', 'a.ts')).toBe('src/a.ts');
	});
});

describe('neighbourAfterRemoval', () => {
	const dirs = new Map<string, DirState>([
		['', { entries: [e('src', 'dir'), e('README.md'), e('setup.py')] }],
		['src', { entries: [e('src/a.py'), e('src/b.py')] }],
	]);
	const rows = buildRows(dirs, new Set(['src']));

	it('picks the next visible entry', () => {
		expect(neighbourAfterRemoval(rows, 'src/a.py')).toBe('src/b.py');
	});

	it('skips the children of a removed folder', () => {
		expect(neighbourAfterRemoval(rows, 'src')).toBe('README.md');
	});

	it('falls back to the previous entry at the end', () => {
		expect(neighbourAfterRemoval(rows, 'setup.py')).toBe('README.md');
	});

	it('returns null when nothing is left or the path is not shown', () => {
		const single = buildRows(new Map([['', { entries: [e('only.py')] }]]), new Set());
		expect(neighbourAfterRemoval(single, 'only.py')).toBeNull();
		expect(neighbourAfterRemoval(rows, 'missing.py')).toBeNull();
	});
});

describe('siblingNames', () => {
	const dirs = new Map<string, DirState>([
		['', { entries: [e('src', 'dir'), e('README.md')] }],
		['src', { entries: [e('src/a.py'), e('src/b.py')] }],
	]);
	const rows = buildRows(dirs, new Set(['src']));

	it('lists the direct children of a folder', () => {
		expect(siblingNames(rows, '')).toEqual(['src', 'README.md']);
		expect(siblingNames(rows, 'src')).toEqual(['a.py', 'b.py']);
	});

	it('leaves out the item being renamed', () => {
		expect(siblingNames(rows, 'src', 'src/a.py')).toEqual(['b.py']);
	});
});

describe('newNameProblem', () => {
	it('accepts a free, valid name', () => {
		expect(newNameProblem('c.py', ['a.py', 'b.py'])).toBeNull();
	});

	it('flags names Windows does not allow', () => {
		expect(newNameProblem('a:b.py', [])).toMatch(/characters/);
		expect(newNameProblem('con.txt', [])).toMatch(/reserved/);
		expect(newNameProblem('notes.', [])).toMatch(/dot or space/);
	});

	it('flags an existing sibling, ignoring case', () => {
		expect(newNameProblem('A.PY', ['a.py'])).toBe('"A.PY" already exists');
	});
});

describe('folder links', () => {
	const link = (path: string, targetKind?: 'file' | 'dir'): FsEntry => ({
		...e(path, 'symlink'),
		...(targetKind ? { targetKind } : {}),
	});

	it('treats a link to a folder as a folder, but not a file link or a broken one', () => {
		expect(isFolder(link('pkg', 'dir'))).toBe(true);
		expect(isFolder(link('a.py', 'file'))).toBe(false);
		expect(isFolder(link('gone'))).toBe(false);
	});

	it('expands a linked folder like a real one', () => {
		const dirs = new Map<string, DirState>([
			['', { entries: [link('pkg', 'dir')] }],
			['pkg', { entries: [e('pkg/mod.py')] }],
		]);
		const rows = buildRows(dirs, new Set(['pkg']));
		expect(rows.map((r) => (r.kind === 'entry' ? r.entry.path : r.kind))).toEqual([
			'pkg',
			'pkg/mod.py',
		]);
	});
});
