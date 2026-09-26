import { execFile, type ExecFileException } from 'node:child_process';

import { AnvilError } from '../../core/errors';

const MAX_DIFF = 200_000;
const TIMEOUT_MS = 10_000;
/** Git's well-known empty tree: the base to diff against before the first commit. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

interface GitRun {
	stdout: string;
	stderr: string;
	error: ExecFileException | null;
}

function runGit(root: string, args: string[]): Promise<GitRun> {
	const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
	delete env['GIT_ASKPASS'];
	delete env['GIT_EDITOR'];
	return new Promise((resolve) => {
		execFile(
			'git',
			['-C', root, ...args],
			{ env, windowsHide: true, maxBuffer: 20 * 1024 * 1024, timeout: TIMEOUT_MS },
			(error, stdout, stderr) => resolve({ stdout, stderr, error }),
		);
	});
}

/** A message the user can act on, from how git failed. */
function describeFailure({ error, stderr }: GitRun): string {
	if (error?.code === 'ENOENT') return 'Git is not installed or not on PATH.';
	if (error?.killed) return `git diff took longer than ${TIMEOUT_MS / 1000} s.`;
	if (/not a git repository/i.test(stderr)) return 'This folder is not a git repository.';
	const line = stderr
		.split('\n')
		.map((l) => l.replace(/^(fatal|error):\s*/, '').trim())
		.find(Boolean);
	return line ? `git diff failed: ${line}` : `git diff failed: ${error?.message ?? 'unknown'}`;
}

function fail(run: GitRun): never {
	throw new AnvilError('AI_GIT_DIFF_FAILED', describeFailure(run), run.error);
}

/**
 * Working-tree (or staged-only) changes against HEAD, capped for the context window. Untracked
 * files are not part of `git diff`. Before the first commit it diffs against the empty tree.
 */
export async function gitDiff(
	root: string,
	staged: boolean,
): Promise<{ diff: string; truncated: boolean }> {
	let base = 'HEAD';
	if (!staged) {
		// Exit 1 with no stderr = a repo with no commits yet; anything else is a real failure.
		const head = await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
		if (head.error) {
			if (head.error.code === 1 && !head.stderr.trim()) base = EMPTY_TREE;
			else fail(head);
		}
	}
	const args = staged
		? ['diff', '--cached', '--no-color', '--no-ext-diff']
		: ['diff', base, '--no-color', '--no-ext-diff'];
	const run = await runGit(root, args);
	// maxBuffer overflow still leaves usable output: send what fits, marked as truncated.
	if (run.error && !(run.error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' && run.stdout))
		fail(run);
	const { stdout } = run;
	return {
		diff: stdout.slice(0, MAX_DIFF),
		truncated: stdout.length > MAX_DIFF || run.error !== null,
	};
}
