import { describe, expect, it } from 'vitest';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { ancestorsOf, buildRows, type DirState, joinPath, parentOf } from './tree-model';

const e = (path: string, kind: FsEntry['kind'] = 'file'): FsEntry => ({
	name: path.split('/').at(-1) ?? path,
	path,
	kind,
	isLink: false,
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
