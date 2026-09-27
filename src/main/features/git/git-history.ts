import type { GitBlame, GitCommit } from '@shared/ipc/channels/git';

import { git, hasHead, isMissingPathError } from './git-process';

// Reading history: the log (of HEAD or of one file), a file at a commit, blame, HEAD content.

export const MAX_TEXT_BYTES = 5 * 1024 * 1024;
export const isBinary = (s: string): boolean => s.includes('\0');

const RECORD = '\x1e';
const FIELD = '\x1f';
// The record separator leads, so `--name-status` output after a header stays in its record.
const FORMAT = '--pretty=format:%x1e%H%x1f%an%x1f%ad%x1f%D%x1f%s';

function commitFields(header: string): GitCommit {
	const [hash = '', author = '', date = '0', refs = '', message = ''] = header.split(FIELD);
	return { hash, author, date: Number(date) * 1000, refs, message };
}

/**
 * Parses `git log -z --name-status` records: a header, then NUL-separated status and path(s)
 * ("R100\0old\0new" for a rename). A commit with no file list (a merge) keeps the path the next
 * newer commit had.
 */
export function parseFileLog(out: string, path: string): GitCommit[] {
	const commits: GitCommit[] = [];
	let current = path;
	for (const record of out.split(RECORD)) {
		if (!record.trim()) continue;
		const newline = record.indexOf('\n');
		const header = newline === -1 ? record.replace(/\0+$/, '') : record.slice(0, newline);
		const [status = '', first, second] = (newline === -1 ? '' : record.slice(newline + 1))
			.split('\0')
			.map((s) => s.trim())
			.filter(Boolean);
		const renamed = /^[RC]/.test(status) && first !== undefined && second !== undefined;
		const filePath = renamed ? second : (first ?? current);
		commits.push({
			...commitFields(header),
			path: filePath,
			...(renamed ? { from: first } : {}),
		});
		// Older commits know the file by its name before this rename.
		current = renamed ? first : filePath;
	}
	return commits;
}

/**
 * Commits of HEAD, newest first. With `repoPath`, only those that touched the file, following
 * renames. An unborn HEAD (no commits yet) has no history; any other failure is reported.
 */
export async function log(root: string, limit: number, repoPath?: string): Promise<GitCommit[]> {
	const g = git(root);
	if (!(await hasHead(g))) return [];
	if (repoPath === undefined) {
		const out = await g.raw(['log', `-n${limit}`, '--date=unix', FORMAT]);
		return out
			.split(RECORD)
			.map((r) => r.trim())
			.filter(Boolean)
			.map(commitFields);
	}
	const out = await g.raw([
		'-c',
		'core.quotePath=false',
		'log',
		`-n${limit}`,
		'--follow',
		'-z',
		'--name-status',
		'--date=unix',
		FORMAT,
		'--',
		repoPath,
	]);
	return parseFileLog(out, repoPath);
}

/**
 * A file as committed in `hash`, or in its first parent. `content` is null when the file didn't
 * exist there (added or deleted in that commit, or a root commit's missing parent); binary or
 * oversized files come back as `binary`.
 */
export async function show(
	root: string,
	hash: string,
	repoPath: string,
	parent = false,
): Promise<{ content: string | null; binary: boolean }> {
	let text: string;
	try {
		text = await git(root).show([`${hash}${parent ? '^' : ''}:${repoPath}`]);
	} catch (error) {
		// The parent of a root commit doesn't exist: "invalid object name '<hash>^'".
		if (isMissingPathError(error) || /invalid object name '[0-9a-f]+\^'/i.test(String(error)))
			return { content: null, binary: false };
		throw error;
	}
	return isBinary(text) || text.length > MAX_TEXT_BYTES
		? { content: null, binary: true }
		: { content: text, binary: false };
}

export async function blame(
	root: string,
	repoPath: string,
	line: number,
): Promise<GitBlame | null> {
	let out: string;
	try {
		out = await git(root).raw([
			'blame',
			'--porcelain',
			'-L',
			`${line},${line}`,
			'--',
			repoPath,
		]);
	} catch (error) {
		// Untracked file, no commits yet, or a line past the committed end: nothing to blame.
		if (isMissingPathError(error)) return null;
		throw error;
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

/** The file as committed in HEAD, for gutter markers; null if untracked or no commits yet. */
export async function headContent(root: string, repoPath: string): Promise<string | null> {
	try {
		const text = await git(root).show([`HEAD:${repoPath}`]);
		return isBinary(text) || text.length > MAX_TEXT_BYTES ? null : text;
	} catch (error) {
		if (isMissingPathError(error)) return null;
		throw error;
	}
}
