import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

import { type SimpleGit, simpleGit, type StatusResult } from 'simple-git';

import type { GitBlame, GitCommit, GitStatus } from '@shared/ipc/channels/git';
import { scanUnifiedDiff, type SecretFinding } from '@shared/secret-scan';

import { AnvilError } from '../../core/errors';
import { toAbsolute } from '../../core/workspace/fs-guard';
import { mapStatus } from './status-map';

const MAX_DIFF_BYTES = 5 * 1024 * 1024;
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

/**
 * Environment for git: an allowlist of what git and Git Credential Manager need. Inheriting
 * everything would leak other tools' hooks (GIT_ASKPASS from VS Code, EDITOR, PAGER…), which
 * simple-git also refuses to run with.
 */
const ENV_ALLOW = new Set(
	[
		'PATH',
		'PATHEXT',
		'SystemRoot',
		'SystemDrive',
		'windir',
		'ComSpec',
		'TEMP',
		'TMP',
		'HOME',
		'HOMEDRIVE',
		'HOMEPATH',
		'USERPROFILE',
		'USERNAME',
		'USERDOMAIN',
		'APPDATA',
		'LOCALAPPDATA',
		'ProgramData',
		'ProgramFiles',
		'ProgramFiles(x86)',
		'ProgramW6432',
		'CommonProgramFiles',
		'LANG',
		'SSH_AUTH_SOCK',
		// The user's SSH client (PuTTY's plink via GIT_SSH, set by TortoiseGit/PuTTY installers).
		'GIT_SSH',
		'GIT_SSH_COMMAND',
		'GIT_SSH_VARIANT',
		// Where git (and GPG for signed commits) find the user's config and identity on Linux.
		'XDG_CONFIG_HOME',
		'GNUPGHOME',
		// Git Credential Manager / askpass windows on Linux.
		'DISPLAY',
		'WAYLAND_DISPLAY',
		'HTTP_PROXY',
		'HTTPS_PROXY',
		'NO_PROXY',
		'http_proxy',
		'https_proxy',
		'no_proxy',
	].map((k) => k.toLowerCase()),
);

export function gitEnv(env: NodeJS.ProcessEnv): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) continue;
		// Windows env names are case-insensitive; GCM_* configures Git Credential Manager.
		if (ENV_ALLOW.has(key.toLowerCase()) || key.startsWith('GCM_') || key.startsWith('LC_')) {
			out[key] = value;
		}
	}
	// Anvil parses git's messages ("not a git repository"), so they must stay in English.
	// LC_ALL would override LC_MESSAGES; keep its character set as LC_CTYPE so non-ASCII paths
	// are still encoded the same way.
	const all = out['LC_ALL'];
	delete out['LC_ALL'];
	if (all !== undefined && out['LC_CTYPE'] === undefined) out['LC_CTYPE'] = all;
	return { ...out, LC_MESSAGES: 'C', GIT_TERMINAL_PROMPT: '0' };
}

function git(baseDir: string): SimpleGit {
	return simpleGit({
		baseDir,
		maxConcurrentProcesses: 4,
		timeout: { block: 60_000 },
		// GIT_TERMINAL_PROMPT=0: never hang on a prompt in an invisible terminal; Git
		// Credential Manager still shows its own window when credentials are needed.
	}).env(gitEnv(process.env));
}

const isBinary = (s: string): boolean => s.includes('\0');

function isNotARepo(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /not a git repository/i.test(message);
}

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

	private async requireRepo(): Promise<{ root: string; g: SimpleGit }> {
		const root = await this.repoRoot();
		if (!root)
			throw new AnvilError('GIT_NOT_A_REPO', 'The open folder is not a git repository');
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
			return rel.startsWith('..') || isAbsolute(rel) ? null : rel.split(sep).join('/');
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
			} catch {
				return '';
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
					.catch(() => '');
		const binary = isBinary(original) || isBinary(modified);
		return binary ? { original: '', modified: '', binary } : { original, modified, binary };
	}

	async stage(paths: string[]): Promise<void> {
		const { root, g } = await this.requireRepo();
		for (const p of paths) toAbsolute(root, p);
		await g.add(['--', ...paths]);
	}

	async unstage(paths: string[]): Promise<void> {
		const { root, g } = await this.requireRepo();
		for (const p of paths) toAbsolute(root, p);
		// `restore --staged` also works before the first commit, unlike `reset HEAD`.
		await g.raw(['restore', '--staged', '--', ...paths]);
	}

	async commit(message: string): Promise<{ hash: string }> {
		const { g } = await this.requireRepo();
		const status = await g.status();
		const anyStaged = status.files.some((f) => f.index !== ' ' && f.index !== '?');
		if (!anyStaged) throw new AnvilError('GIT_NOTHING_STAGED', 'Nothing is staged to commit');
		const result = await g.commit(message);
		if (!result.commit)
			throw new AnvilError('GIT_COMMIT_FAILED', 'git did not create a commit');
		return { hash: result.commit };
	}

	async pull(): Promise<{ summary: string }> {
		const { g } = await this.requireRepo();
		const r = await g.pull();
		const { changes, insertions, deletions } = r.summary;
		return { summary: `${changes} files changed, +${insertions} −${deletions}` };
	}

	async push(): Promise<{ summary: string }> {
		const { g } = await this.requireRepo();
		const s = await g.status();
		if (!s.current || s.detached)
			throw new AnvilError('GIT_DETACHED', 'Check out a branch before pushing');
		if (s.tracking) {
			await g.push();
			return { summary: `Pushed ${s.current} → ${s.tracking}` };
		}
		// First push of a new branch: publish it and set upstream.
		await g.push(['-u', 'origin', s.current]);
		return { summary: `Published ${s.current} to origin` };
	}

	async branches(): Promise<{ current: string | null; local: string[] }> {
		const { g } = await this.requireRepo();
		const b = await g.branchLocal();
		return { current: b.current || null, local: b.all };
	}

	async checkout(branch: string, create: boolean): Promise<void> {
		const { g } = await this.requireRepo();
		if (!/^[\w./-]+$/.test(branch) || branch.startsWith('-'))
			throw new AnvilError('GIT_BAD_BRANCH', `Invalid branch name: ${branch}`);
		if (create) await g.checkoutLocalBranch(branch);
		else await g.checkout(branch);
	}

	async log(limit: number): Promise<GitCommit[]> {
		const { g } = await this.requireRepo();
		try {
			const out = await g.raw([
				'log',
				`-n${limit}`,
				'--date=unix',
				'--pretty=format:%H%x1f%an%x1f%ad%x1f%D%x1f%s%x1e',
			]);
			return out
				.split('\x1e')
				.map((r) => r.trim())
				.filter(Boolean)
				.map((r) => {
					const [hash = '', author = '', date = '0', refs = '', message = ''] =
						r.split('\x1f');
					return { hash, author, date: Number(date) * 1000, refs, message };
				});
		} catch {
			// A repo without commits has no log.
			return [];
		}
	}

	/**
	 * Repo-relative path of a path relative to the open folder, which may be a subfolder of the
	 * repo. Goes through the real workspace path: git reports long names, the folder may have
	 * been opened via an 8.3 short name.
	 */
	private repoPathOfWorkspacePath(root: string, path: string): string {
		const workspace = this.getWorkspaceRoot();
		if (!workspace) throw new AnvilError('GIT_NOT_A_REPO', 'No folder is open');
		const abs = toAbsolute(realpathSync.native(workspace), path);
		return relative(root, abs).split(sep).join('/');
	}

	/** `path` is relative to the open folder (the editor's view), not to the repo root. */
	async blame(path: string, line: number): Promise<GitBlame | null> {
		const { root, g } = await this.requireRepo();
		const repoPath = this.repoPathOfWorkspacePath(root, path);
		let out: string;
		try {
			out = await g.raw(['blame', '--porcelain', '-L', `${line},${line}`, '--', repoPath]);
		} catch {
			return null;
		}
		const hash = out.slice(0, 40);
		if (!/^[0-9a-f]{40}$/.test(hash) || /^0+$/.test(hash)) return null;
		const field = (name: string): string =>
			new RegExp(`^${name} (.*)$`, 'm').exec(out)?.[1]?.trim() ?? '';
		return {
			hash,
			author: field('author'),
			date: Number(field('author-time')) * 1000,
			summary: field('summary'),
		};
	}

	/** `path` is relative to the open folder (the editor's view), not to the repo root. */
	async headContent(path: string): Promise<string | null> {
		const root = await this.repoRoot();
		if (!root) return null;
		const repoPath = this.repoPathOfWorkspacePath(root, path);
		try {
			const text = await git(root).show([`HEAD:${repoPath}`]);
			return isBinary(text) || text.length > MAX_DIFF_BYTES ? null : text;
		} catch {
			return null;
		}
	}

	async scanStaged(): Promise<SecretFinding[]> {
		const { g } = await this.requireRepo();
		const diff = await g.raw(['diff', '--cached', '--no-color', '--no-ext-diff', '-U0']);
		return scanUnifiedDiff(diff);
	}
}
