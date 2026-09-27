import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

import type { SimpleGit, StatusResult } from 'simple-git';

import type { GitStatus } from '@shared/ipc/channels/git';
import { scanUnifiedDiff, type SecretFinding } from '@shared/secret-scan';

import { AnvilError } from '../../core/errors';
import { toAbsolute } from '../../core/workspace/fs-guard';
import { isBinary, MAX_TEXT_BYTES as MAX_DIFF_BYTES } from './git-history';
import { batchPaths, git, hasHead, isMissingPathError, isNotARepo, queued } from './git-process';
import { mapStatus } from './status-map';

const NOT_A_REPO: GitStatus = {
	isRepo: false,
	branch: null,
	detached: false,
	tracking: null,
	ahead: 0,
	behind: 0,
	staged: [],
	unstaged: [],
};

/** A line starting a conflict side (`<<<<<<< ours`), the divider, or the end (`>>>>>>> theirs`). */
const CONFLICT_MARKER = /^(?:<{7}|>{7})(?: |\r?$)|^={7}\r?$/m;

/** Git for the open folder, via the system git (simple-git). The repo root may be above it. */
export class GitService {
	private repoRootCache: { workspace: string; root: string } | null = null;

	constructor(private readonly getWorkspaceRoot: () => string | null) {}

	private async repoRoot(): Promise<string | null> {
		const workspace = this.getWorkspaceRoot();
		if (!workspace) return null;
		if (this.repoRootCache?.workspace === workspace) return this.repoRootCache.root;
		let root: string | null = null;
		try {
			const top = (await git(workspace).revparse(['--show-toplevel'])).trim();
			root = top ? join(top) : null;
		} catch (error) {
			// "Not a repo" is a normal state; anything else (git missing, blocked env…) is a real error.
			if (!isNotARepo(error)) throw error;
			root = null;
		}
		// Only a found repo is cached: a plain folder must notice `git init` run in a terminal
		// (the empty state suggests exactly that), and rev-parse is cheap enough to repeat.
		this.repoRootCache = root ? { workspace, root } : null;
		return root;
	}

	/** The repo root; throws GIT_NOT_A_REPO when there is none. */
	async repo(): Promise<string> {
		const root = await this.repoRoot();
		if (!root)
			throw new AnvilError('GIT_NOT_A_REPO', 'The open folder is not a git repository');
		return root;
	}

	/** The repo root and a read-only git there (reads never take optional locks). */
	private async requireRepo(): Promise<{ root: string; g: SimpleGit }> {
		const root = await this.repo();
		return { root, g: git(root) };
	}

	/** Forget the cached repo root (folder switched, or `git init` ran). */
	reset(): void {
		this.repoRootCache = null;
	}

	async status(): Promise<GitStatus> {
		const root = await this.repoRoot();
		const workspace = this.getWorkspaceRoot();
		if (!root || !workspace) return NOT_A_REPO;
		let s: StatusResult;
		try {
			// -uall lists files inside new folders instead of collapsing them to "folder/".
			s = await git(root).status(['-uall']);
		} catch (error) {
			// The cached repo is gone (.git deleted): back to the "not a repo" state.
			if (!isNotARepo(error)) throw error;
			this.reset();
			return NOT_A_REPO;
		}
		// git reports long paths; the folder may have been opened via an 8.3 short name (PCGAME~1).
		const realWorkspace = realpathSync.native(workspace);
		const toWorkspacePath = (repoPath: string): string | null => {
			const rel = relative(realWorkspace, join(root, repoPath));
			// Not startsWith('..'): '..env.bak' is a file inside the folder.
			const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
			return outside ? null : rel.split(sep).join('/');
		};
		return {
			isRepo: true,
			branch: s.current,
			detached: s.detached,
			tracking: s.tracking,
			ahead: s.ahead,
			behind: s.behind,
			...mapStatus(s.files, toWorkspacePath),
		};
	}

	/**
	 * Both sides of a diff as text. Unstaged: index → working tree. Staged: HEAD → index.
	 * A missing side (new or deleted file) is an empty string.
	 */
	async diff(
		path: string,
		staged: boolean,
		from?: string,
	): Promise<{ original: string; modified: string; binary: boolean }> {
		const { root, g } = await this.requireRepo();
		const abs = toAbsolute(root, path);
		const show = async (spec: string): Promise<string> => {
			try {
				return await g.show([spec]);
			} catch (error) {
				// A new, deleted or conflicted file has no version there; anything else is real.
				if (isMissingPathError(error)) return '';
				throw error;
			}
		};
		const repoPath = relative(root, abs).split(sep).join('/');
		// A staged rename's HEAD side lives at its old path.
		const headPath = from
			? relative(root, toAbsolute(root, from)).split(sep).join('/')
			: repoPath;
		const original = staged ? await show(`HEAD:${headPath}`) : await show(`:${repoPath}`);
		const modified = staged
			? await show(`:${repoPath}`)
			: await readFile(abs)
					.then((b) => (b.length > MAX_DIFF_BYTES ? '\0' : b.toString('utf8')))
					.catch((error: unknown) => {
						// Deleted in the working tree: the modified side is empty.
						if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
						throw error;
					});
		const binary = isBinary(original) || isBinary(modified);
		return binary ? { original: '', modified: '', binary } : { original, modified, binary };
	}

	async stage(paths: string[]): Promise<void> {
		const { root } = await this.requireRepo();
		for (const p of paths) toAbsolute(root, p);
		const g = git(root, 'write');
		await queued(root, 'index', async () => {
			for (const batch of batchPaths(paths)) await g.add(['--', ...batch]);
		});
	}

	async unstage(paths: string[]): Promise<void> {
		const { root } = await this.requireRepo();
		for (const p of paths) toAbsolute(root, p);
		const g = git(root, 'write');
		await queued(root, 'index', async () => {
			const born = await hasHead(g);
			for (const batch of batchPaths(paths)) {
				if (born) await g.raw(['restore', '--staged', '--', ...batch]);
				// Before the first commit there is no HEAD to restore from ("could not resolve
				// HEAD"), so take the paths out of the index; they become untracked again. --cached
				// never touches the working tree, -r lets a folder through, and -f skips the "staged
				// content differs from the file" check: dropping the staged copy is what unstage means.
				else await g.raw(['rm', '--cached', '-r', '-f', '-q', '--', ...batch]);
			}
		});
	}

	/**
	 * Throws away working-tree changes. Tracked files go back to their index version, so for a
	 * file staged and then edited only the later, unstaged edits are lost (VS Code's Discard
	 * Changes). Untracked files are deleted; git has no copy of them, so the UI asks first.
	 */
	async discard(tracked: string[], untracked: string[]): Promise<void> {
		const root = await this.repo();
		for (const p of [...tracked, ...untracked]) toAbsolute(root, p);
		const g = git(root, 'write');
		await queued(root, 'index', async () => {
			for (const batch of batchPaths(tracked))
				await g.raw(['restore', '--worktree', '--', ...batch]);
			// clean never touches tracked or ignored files, whatever paths it is given.
			for (const batch of batchPaths(untracked))
				await g.raw(['clean', '-f', '-q', '--', ...batch]);
		});
	}

	/** `git init` in the open folder itself, not in a parent repository it may sit in. */
	async init(): Promise<void> {
		const workspace = this.getWorkspaceRoot();
		if (!workspace) throw new AnvilError('GIT_NO_FOLDER', 'Open a folder first');
		if (await this.repoRoot())
			throw new AnvilError(
				'GIT_ALREADY_A_REPO',
				'The open folder is already in a repository',
			);
		await git(workspace, 'write').init();
		this.reset();
	}

	/**
	 * Paths (of those given) whose working copy still has conflict markers. Staging a conflicted
	 * file is how git marks it resolved, so a forgotten `<<<<<<<` would be committed as is.
	 */
	async conflictMarkers(paths: string[]): Promise<string[]> {
		const root = await this.repo();
		const hits: string[] = [];
		for (const p of paths) {
			const text = await readFile(toAbsolute(root, p), 'utf8').catch(
				(error: NodeJS.ErrnoException) => {
					// Deleted on one side of the conflict: nothing to scan.
					if (error.code === 'ENOENT' || error.code === 'EISDIR') return '';
					throw error;
				},
			);
			if (CONFLICT_MARKER.test(text)) hits.push(p);
		}
		return hits;
	}

	/**
	 * Commits what is staged. `amend` replaces the last commit instead (its message, plus
	 * anything staged now), so it needs no staged changes but does need a commit to amend.
	 */
	async commit(message: string, amend = false): Promise<{ hash: string }> {
		const { root, g } = await this.requireRepo();
		return queued(root, 'index', async () => {
			if (amend) {
				if (!(await hasHead(g)))
					throw new AnvilError('GIT_NOTHING_TO_AMEND', 'There is no commit to amend yet');
			} else {
				const status = await g.status();
				const anyStaged = status.files.some((f) => f.index !== ' ' && f.index !== '?');
				if (!anyStaged)
					throw new AnvilError('GIT_NOTHING_STAGED', 'Nothing is staged to commit');
			}
			// 'long': a pre-commit hook or a GPG passphrase prompt may take minutes.
			const result = await git(root, 'long').commit(
				message,
				undefined,
				amend ? { '--amend': null } : {},
			);
			if (!result.commit)
				throw new AnvilError('GIT_COMMIT_FAILED', 'git did not create a commit');
			return { hash: result.commit };
		});
	}

	/**
	 * A path relative to the open folder (what editor tabs use) as the repo root plus the same
	 * file relative to it; they differ when the folder is a subfolder of the repository. Goes
	 * through the real workspace path: git reports long names, and the folder may have been
	 * opened via an 8.3 short name (PCGAME~1). Null when there is no repository.
	 */
	async locate(workspacePath: string): Promise<{ root: string; repoPath: string } | null> {
		const workspace = this.getWorkspaceRoot();
		const root = await this.repoRoot();
		if (!workspace || !root) return null;
		const abs = toAbsolute(realpathSync.native(workspace), workspacePath);
		return { root, repoPath: relative(root, abs).split(sep).join('/') };
	}

	/** HEAD's full message, to prefill an amend; null before the first commit. */
	async lastCommitMessage(): Promise<string | null> {
		const { g } = await this.requireRepo();
		if (!(await hasHead(g))) return null;
		return (await g.raw(['log', '-1', '--format=%B'])).trimEnd();
	}

	async scanStaged(): Promise<SecretFinding[]> {
		const { g } = await this.requireRepo();
		// Unquoted non-ASCII names, so findings point at a file the user can open.
		const diff = await g.raw([
			'-c',
			'core.quotePath=false',
			'diff',
			'--cached',
			'--no-color',
			'--no-ext-diff',
			'-U0',
		]);
		return scanUnifiedDiff(diff);
	}
}
