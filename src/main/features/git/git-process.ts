import { type SimpleGit, simpleGit } from 'simple-git';

import { gitEnv } from '../../core/git-env';

/**
 * - `read`: status, diff, show, log, blame. Runs with GIT_OPTIONAL_LOCKS=0, the environment form
 *   of `--no-optional-locks` (simple-git's status() can't take a global flag): the 5 s status
 *   poll then never takes index.lock, so it can't collide with a commit in a terminal.
 * - `write`: quick local mutations (stage, checkout, stash) with a 60 s safety timeout.
 * - `long`: commit, pull, push, fetch. No timeout: a slow pre-commit hook or a first Git
 *   Credential Manager sign-in can be silent for minutes, and killing it loses the operation.
 */
export type GitKind = 'read' | 'write' | 'long';

/**
 * simple-git refuses GIT_SSH, GIT_SSH_COMMAND, GIT_CONFIG_GLOBAL, GIT_PROXY_COMMAND and
 * GIT_TEMPLATE_DIR in the environment unless allowed. Here they come from the user's own
 * environment (the same trust as their terminal), and plink or a custom config needs them.
 * Anvil never builds `-c` options from untrusted input, which is what these checks guard.
 */
const UNSAFE = {
	allowUnsafeSshCommand: true,
	allowUnsafeConfigPaths: true,
	allowUnsafeGitProxy: true,
	allowUnsafeTemplateDir: true,
};

const BLOCK_TIMEOUT_MS = 60_000;

export function git(
	baseDir: string,
	kind: GitKind = 'read',
	extraEnv: Record<string, string> = {},
): SimpleGit {
	return simpleGit({
		baseDir,
		maxConcurrentProcesses: 4,
		unsafe: UNSAFE,
		...(kind === 'long' ? {} : { timeout: { block: BLOCK_TIMEOUT_MS } }),
	}).env({
		...gitEnv(process.env),
		...(kind === 'read' ? { GIT_OPTIONAL_LOCKS: '0' } : {}),
		...extraEnv,
	});
}

export type GitLane = 'index' | 'remote';

const tails = new Map<string, Promise<void>>();

/**
 * Runs mutating operations on one repository one at a time. Two at once (stage while a pull
 * merges) fight over index.lock, and one fails with "Another git process seems to be running".
 * Remote operations get their own lane so staging stays responsive during a long push.
 */
export function queued<T>(root: string, lane: GitLane, op: () => Promise<T>): Promise<T> {
	const key = `${process.platform === 'win32' ? root.toLowerCase() : root}|${lane}`;
	const previous = tails.get(key) ?? Promise.resolve();
	const result = previous.then(op);
	const tail = result.then(
		() => undefined,
		() => undefined,
	);
	tails.set(key, tail);
	void tail.then(() => {
		if (tails.get(key) === tail) tails.delete(key);
	});
	return result;
}

/**
 * Splits paths into argv batches. Windows caps a command line at 32 767 characters, and
 * Stage All can send thousands of long paths; 8 000 leaves room for git's own arguments.
 */
export function batchPaths(paths: readonly string[], maxChars = 8_000): string[][] {
	const batches: string[][] = [];
	let batch: string[] = [];
	let size = 0;
	for (const p of paths) {
		// +3: separating space and quotes Node adds around arguments with spaces.
		const cost = p.length + 3;
		if (batch.length > 0 && size + cost > maxChars) {
			batches.push(batch);
			batch = [];
			size = 0;
		}
		batch.push(p);
		size += cost;
	}
	if (batch.length > 0) batches.push(batch);
	return batches;
}

/** git's "not a git repository" failure (messages are forced to English by gitEnv). */
export function isNotARepo(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /not a git repository/i.test(message);
}

/**
 * git failures that only mean "this path has no version there": untracked, new, deleted or
 * conflicted files, no commits yet, or a blame line past the committed end. Matched on
 * English text, which gitEnv guarantees.
 */
const MISSING_PATH =
	/invalid object name 'HEAD'|no such ref: HEAD|does not exist|exists on disk, but not in|is in the index, but not at stage|no such path|has only \d+ lines?/i;

export function isMissingPathError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return MISSING_PATH.test(message);
}

/**
 * False while HEAD is unborn (a fresh `git init`, no commits yet). `rev-parse --verify -q` exits
 * 1 silently then, which simple-git resolves as empty output; real failures write to stderr and
 * still reject.
 */
export async function hasHead(g: SimpleGit): Promise<boolean> {
	return (await g.raw(['rev-parse', '--verify', '-q', 'HEAD'])).trim() !== '';
}

/** `git log` in a repo without commits (older git says "bad default revision 'HEAD'"). */
export function isUnbornHead(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /does not have any commits yet|bad default revision 'HEAD'/i.test(message);
}
