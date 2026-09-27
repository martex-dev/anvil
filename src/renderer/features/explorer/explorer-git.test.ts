import { describe, expect, it } from 'vitest';

import type { GitChange, GitStatus } from '@shared/ipc/channels/git';

import { decorationFor, gitDecorations, NO_GIT } from './explorer-git';

const change = (workspacePath: string | null, kind: GitChange['kind']): GitChange => ({
	path: workspacePath ?? 'outside.py',
	kind,
	workspacePath,
});

const status = (staged: GitChange[], unstaged: GitChange[]): GitStatus => ({
	isRepo: true,
	branch: 'main',
	detached: false,
	tracking: null,
	ahead: 0,
	behind: 0,
	staged,
	unstaged,
});

describe('gitDecorations', () => {
	it('gives files a letter and folders their most urgent change', () => {
		const git = gitDecorations(
			status(
				[change('src/a.py', 'added')],
				[change('src/lib/b.py', 'modified'), change('src/lib/c.py', 'conflicted')],
			),
		);
		expect(decorationFor(git, 'src/a.py', false)?.letter).toBe('A');
		expect(decorationFor(git, 'src/lib/b.py', false)?.letter).toBe('M');
		expect(decorationFor(git, 'src', true)?.kind).toBe('conflicted');
		expect(decorationFor(git, 'docs', true)).toBeUndefined();
	});

	it('lets a later edit of a staged file win when it is more urgent', () => {
		const git = gitDecorations(status([change('a.py', 'added')], [change('a.py', 'modified')]));
		expect(decorationFor(git, 'a.py', false)?.kind).toBe('modified');
	});

	it('marks an untracked folder reported whole and skips files outside the folder', () => {
		const git = gitDecorations(
			status([], [change('new/', 'untracked'), change(null, 'modified')]),
		);
		expect(decorationFor(git, 'new', true)?.letter).toBe('U');
		expect(git.files.size).toBe(1);
	});

	it('is empty outside a repository', () => {
		expect(gitDecorations(undefined)).toBe(NO_GIT);
		expect(gitDecorations({ ...status([], []), isRepo: false })).toBe(NO_GIT);
	});
});
