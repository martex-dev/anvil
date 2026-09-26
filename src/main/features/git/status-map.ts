import type { GitChange, GitChangeKind } from '@shared/ipc/channels/git';

export interface PorcelainFile {
	path: string;
	from?: string | undefined;
	/** X: index (staged) status letter. */
	index: string;
	/** Y: working tree (unstaged) status letter. */
	working_dir: string;
}

const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

function kindFor(letter: string): GitChangeKind | null {
	switch (letter) {
		case 'M':
		case 'T':
			return 'modified';
		case 'A':
		case 'C':
			return 'added';
		case 'D':
			return 'deleted';
		case 'R':
			return 'renamed';
		default:
			return null;
	}
}

/**
 * Splits `git status --porcelain` entries into the Source Control view's two lists. A file
 * modified, staged, then modified again appears in both — exactly like VS Code.
 */
export function mapStatus(
	files: readonly PorcelainFile[],
	toWorkspacePath: (repoPath: string) => string | null,
): { staged: GitChange[]; unstaged: GitChange[] } {
	const staged: GitChange[] = [];
	const unstaged: GitChange[] = [];
	for (const f of files) {
		const code = `${f.index}${f.working_dir}`;
		const base = {
			path: f.path,
			workspacePath: toWorkspacePath(f.path),
			...(f.from ? { from: f.from } : {}),
		};
		if (code === '??') {
			unstaged.push({ ...base, kind: 'untracked' });
			continue;
		}
		if (CONFLICT_CODES.has(code)) {
			unstaged.push({ ...base, kind: 'conflicted' });
			continue;
		}
		const indexKind = kindFor(f.index);
		if (indexKind) staged.push({ ...base, kind: indexKind });
		const workKind = kindFor(f.working_dir);
		if (workKind) unstaged.push({ ...base, kind: workKind });
	}
	const byPath = (a: GitChange, b: GitChange): number => a.path.localeCompare(b.path);
	return { staged: staged.sort(byPath), unstaged: unstaged.sort(byPath) };
}
