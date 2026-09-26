import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import type { SearchQuery, SearchResult } from '@shared/ipc/channels/search';
import { SearchQuerySchema } from '@shared/ipc/channels/search';

import { AnvilError } from '../../core/errors';
import { IGNORED_DIRS } from '../../core/workspace/watcher';
import { ResultCollector, splitGlobs } from './rg-parse';

export const MATCH_LIMIT = 2_000;
const TIMEOUT_MS = 20_000;

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
		'--max-filesize',
		'2M',
		// Per-file cap: one huge generated file shouldn't eat the whole result budget.
		'--max-count',
		'200',
		q.caseSensitive ? '--case-sensitive' : '--ignore-case',
	];
	if (!q.regex) args.push('--fixed-strings');
	if (q.wholeWord) args.push('--word-regexp');
	// .gitignore is honoured by default; these also apply outside git repos.
	for (const dir of IGNORED_DIRS) args.push('--glob', `!**/${dir}/**`);
	for (const glob of splitGlobs(q.include)) args.push('--glob', glob);
	for (const glob of splitGlobs(q.exclude)) args.push('--glob', `!${glob}`);
	args.push('--', q.query, '.');
	return args;
}

/** One search at a time: a new query (the user kept typing) kills the previous rg. */
export class Ripgrep {
	private current: ChildProcess | null = null;

	constructor(private readonly binary: string = rgPath()) {}

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
			stderr += chunk.toString('utf8').slice(0, 2_000);
		});
		const lines = createInterface({ input: child.stdout });
		lines.on('line', (line) => {
			if (!collector.add(line)) child.kill();
		});

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
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
				// rg exits 1 for "no matches" and 2 for errors such as an invalid regex.
				if (code === 2 && collector.count === 0) {
					const message = stderr.split('\n').find((l) => l.trim()) ?? 'ripgrep failed';
					reject(new AnvilError('SEARCH_BAD_QUERY', message.replace(/^rg: /, '')));
					return;
				}
				resolve({
					files: collector.result(),
					matchCount: collector.count,
					truncated: collector.truncated,
					durationMs: Math.round(performance.now() - started),
				});
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
	const args = ['--files', '--hidden', '--glob', '!.git/**'];
	for (const dir of IGNORED_DIRS) args.push('--glob', `!**/${dir}/**`);
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
		const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
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
