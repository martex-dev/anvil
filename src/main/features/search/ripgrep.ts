import { type ChildProcess, spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import log from 'electron-log/main';

import type { SearchFile, SearchQuery, SearchResult } from '@shared/ipc/channels/search';
import { SearchQuerySchema } from '@shared/ipc/channels/search';

import { AnvilError } from '../../core/errors';
import { PER_FILE_LIMIT, ResultCollector, splitGlobs } from './rg-parse';

export const MATCH_LIMIT = 2_000;

/**
 * Records each file's mtime, so Replace can tell whether a file changed since the search. Taken
 * right after ripgrep finishes; an edit in that instant is still caught by Replace re-checking
 * that every listed line matches.
 */
async function withMtimes(root: string, files: SearchFile[]): Promise<SearchFile[]> {
	return Promise.all(
		files.map(async (f) => {
			const s = await stat(join(root, f.path)).catch(() => null);
			return s ? { ...f, mtimeMs: s.mtimeMs } : f;
		}),
	);
}

/**
 * Always skipped, even outside a git repo or when committed: dependency and virtualenv trees and
 * tool caches, which are never what a search is for. Build output (out, dist, build, .cache) is
 * left to .gitignore, like VS Code does: a tracked dist/ or a data folder named build/ is searched.
 */
export const SEARCH_EXCLUDED_DIRS = [
	'.git',
	'node_modules',
	'.venv',
	'venv',
	'__pycache__',
	'.pytest_cache',
	'.ruff_cache',
	'.mypy_cache',
];

/**
 * .gitignore decides what else is skipped, in a folder that isn't a git repo too (ripgrep only
 * reads .gitignore inside one unless told otherwise).
 */
const excludeArgs = (): string[] => [
	'--no-require-git',
	...SEARCH_EXCLUDED_DIRS.flatMap((dir) => ['--glob', `!**/${dir}/**`]),
];
const TIMEOUT_MS = 20_000;
const STDERR_LIMIT = 4_000;

const QUERY_ERROR =
	/regex parse error|error parsing glob|not allowed in a regex|exceeds size limit/i;

/** The query's own fault (bad regex or glob) as a user-facing error; null for other rg errors. */
export function queryError(stderr: string): AnvilError | null {
	if (!QUERY_ERROR.test(stderr)) return null;
	// A regex error spans lines: "regex parse error:", the pattern, a caret, then "error: why".
	const lines = stderr
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
	const first = (lines[0] ?? 'ripgrep failed').replace(/^rg: /, '');
	const reason = lines
		.find((l) => l.startsWith('error:'))
		?.slice('error:'.length)
		.trim();
	const message = reason ? `${first.replace(/:$/, '')}: ${reason}` : first;
	return new AnvilError('SEARCH_BAD_QUERY', message);
}

/**
 * Path of the bundled rg binary. `@vscode/ripgrep` ships it in a per-platform package; in a
 * packaged app it has to live outside the asar archive to be executable.
 */
export function rgPath(): string {
	const bin = process.platform === 'win32' ? 'rg.exe' : 'rg';
	const resolved = require.resolve(
		`@vscode/ripgrep-${process.platform}-${process.arch}/bin/${bin}`,
	);
	return resolved.replace(/\.asar([\\/])/, '.asar.unpacked$1');
}

export function rgArgs(input: SearchQuery): string[] {
	const q = SearchQuerySchema.parse(input);
	const args = [
		'--json',
		// Dotfiles (.github/, .env.example, .pre-commit-config.yaml) are code too, and Quick Open
		// lists them; .git itself is excluded through SEARCH_EXCLUDED_DIRS below.
		'--hidden',
		'--max-filesize',
		'2M',
		// Per-file cap: one huge generated file shouldn't eat the whole result budget.
		'--max-count',
		String(PER_FILE_LIMIT),
		q.caseSensitive ? '--case-sensitive' : '--ignore-case',
	];
	if (!q.regex) args.push('--fixed-strings');
	if (q.wholeWord) args.push('--word-regexp');
	args.push(...excludeArgs());
	for (const glob of splitGlobs(q.include)) args.push('--glob', glob);
	for (const glob of splitGlobs(q.exclude)) args.push('--glob', `!${glob}`);
	args.push('--', q.query, '.');
	return args;
}

/** One search at a time: a new query (the user kept typing) kills the previous rg. */
export class Ripgrep {
	private current: ChildProcess | null = null;

	constructor(
		private readonly binary: string = rgPath(),
		private readonly timeoutMs: number = TIMEOUT_MS,
	) {}

	cancel(): void {
		this.current?.kill();
		this.current = null;
	}

	search(root: string, query: SearchQuery): Promise<SearchResult> {
		this.cancel();
		const started = performance.now();
		const collector = new ResultCollector(MATCH_LIMIT);
		const child = spawn(this.binary, rgArgs(query), { cwd: root, windowsHide: true });
		this.current = child;
		let stderr = '';
		child.stderr.on('data', (chunk: Buffer) => {
			// Bounded: a folder full of unreadable files can print an error per file.
			if (stderr.length < STDERR_LIMIT) stderr += chunk.toString('utf8');
		});
		const lines = createInterface({ input: child.stdout });
		lines.on('line', (line) => {
			if (!collector.add(line)) child.kill();
		});

		return new Promise((resolve, reject) => {
			// A search that runs too long is stopped and shown as partial, never as complete.
			let timedOut = false;
			const timer = setTimeout(() => {
				timedOut = true;
				child.kill();
			}, this.timeoutMs);
			child.on('error', (error) => {
				clearTimeout(timer);
				reject(
					new AnvilError(
						'SEARCH_FAILED',
						`Could not run ripgrep: ${error.message}`,
						error,
					),
				);
			});
			child.on('close', (code, signal) => {
				clearTimeout(timer);
				const superseded = this.current !== child;
				if (!superseded) this.current = null;
				if (superseded && signal) {
					reject(new AnvilError('SEARCH_CANCELLED', 'Search replaced by a newer one'));
					return;
				}
				// rg exits 1 for "no matches" and 2 for errors: an invalid regex or glob (the query's
				// fault), or I/O errors such as locked or access-denied files (skip those, keep results).
				const bad = code === 2 ? queryError(stderr) : null;
				if (bad) {
					reject(bad);
					return;
				}
				if (code === 2) log.warn('[search] ripgrep reported errors', { stderr });
				void withMtimes(root, collector.result()).then((files) =>
					resolve({
						files,
						matchCount: collector.count,
						truncated: collector.truncated || timedOut,
						timedOut,
						durationMs: Math.round(performance.now() - started),
					}),
				);
			});
		});
	}
}

const FILE_LIMIT = 50_000;

/** Every file in the folder, gitignore-aware and without the usual heavy directories. */
export function listFiles(
	root: string,
	binary: string = rgPath(),
): Promise<{ files: string[]; truncated: boolean }> {
	const args = ['--files', '--hidden', ...excludeArgs()];
	const child = spawn(binary, args, { cwd: root, windowsHide: true });
	const files: string[] = [];
	let truncated = false;
	const lines = createInterface({ input: child.stdout });
	lines.on('line', (line) => {
		if (files.length >= FILE_LIMIT) {
			truncated = true;
			child.kill();
			return;
		}
		if (line) files.push(line.replaceAll('\\', '/').replace(/^\.\//, ''));
	});
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			// A partial list must say so, or Quick Open silently misses files.
			truncated = true;
			child.kill();
		}, TIMEOUT_MS);
		child.on('error', (error) => {
			clearTimeout(timer);
			reject(new AnvilError('SEARCH_FAILED', `Could not run ripgrep: ${error.message}`));
		});
		child.on('close', () => {
			clearTimeout(timer);
			files.sort();
			resolve({ files, truncated });
		});
	});
}
