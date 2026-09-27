import type { GitChangeKind, GitStatus } from '@shared/ipc/channels/git';

/** How a changed file shows in the tree: a letter badge and a token colour class. */
export interface GitDecoration {
	kind: GitChangeKind;
	letter: string;
	/** Tailwind token class for the name and badge. */
	tone: string;
	label: string;
}

const DECORATION: Record<GitChangeKind, Omit<GitDecoration, 'kind'>> = {
	conflicted: { letter: '!', tone: 'text-down', label: 'conflicted' },
	deleted: { letter: 'D', tone: 'text-down', label: 'deleted' },
	modified: { letter: 'M', tone: 'text-warn', label: 'modified' },
	renamed: { letter: 'R', tone: 'text-info', label: 'renamed' },
	added: { letter: 'A', tone: 'text-up', label: 'added' },
	untracked: { letter: 'U', tone: 'text-up', label: 'untracked' },
};

/** When a file is both staged and changed again, the more urgent state wins. */
const RANK: Record<GitChangeKind, number> = {
	conflicted: 0,
	deleted: 1,
	modified: 2,
	renamed: 3,
	added: 4,
	untracked: 5,
};

export interface GitDecorations {
	files: ReadonlyMap<string, GitDecoration>;
	/** Folders with a change somewhere inside, and the most urgent one among them. */
	folders: ReadonlyMap<string, GitDecoration>;
}

export const NO_GIT: GitDecorations = { files: new Map(), folders: new Map() };

/** Decorations by workspace-relative path, from the git status query. */
export function gitDecorations(status: GitStatus | undefined): GitDecorations {
	if (!status?.isRepo) return NO_GIT;
	const files = new Map<string, GitDecoration>();
	const folders = new Map<string, GitDecoration>();
	const keepWorst = (
		map: Map<string, GitDecoration>,
		path: string,
		kind: GitChangeKind,
	): void => {
		const current = map.get(path);
		if (!current || RANK[kind] < RANK[current.kind])
			map.set(path, { kind, ...DECORATION[kind] });
	};
	for (const change of [...status.staged, ...status.unstaged]) {
		// An untracked folder is reported whole, as `new-dir/`.
		const path = change.workspacePath?.replace(/\/+$/, '');
		if (!path) continue;
		keepWorst(files, path, change.kind);
		const parts = path.split('/');
		for (let i = 1; i < parts.length; i++)
			keepWorst(folders, parts.slice(0, i).join('/'), change.kind);
	}
	return { files, folders };
}

/** The decoration for one tree row: a folder shows what changed inside it. */
export function decorationFor(
	git: GitDecorations,
	path: string,
	isDir: boolean,
): GitDecoration | undefined {
	return isDir ? (git.folders.get(path) ?? git.files.get(path)) : git.files.get(path);
}
