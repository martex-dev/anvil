import { existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { type FSWatcher, watch } from 'chokidar';

/** Heavy or generated folders that would flood the watcher and the tree, at any depth. */
const ALWAYS_IGNORED = new Set([
	'node_modules',
	'.git',
	'.venv',
	'venv',
	'__pycache__',
	'.pytest_cache',
	'.ruff_cache',
	'.mypy_cache',
	'.next',
	'.turbo',
	'.cache',
]);

/** Folder names that are build output in JS/Python projects, but often data folders elsewhere. */
const BUILD_OUTPUT = ['out', 'dist', 'build'];

/** Everything search skips (it has no per-project context, and build output is noise there). */
export const IGNORED_DIRS: ReadonlySet<string> = new Set([...ALWAYS_IGNORED, ...BUILD_OUTPUT]);

/**
 * Top-level folders to treat as build output, based on the project files in the root. A research
 * script writing results to out/ or build/ elsewhere must still be watched.
 */
export function buildOutputDirs(root: string): ReadonlySet<string> {
	const has = (name: string): boolean => existsSync(join(root, name));
	if (has('package.json') || has('tsconfig.json')) return new Set(BUILD_OUTPUT);
	if (has('pyproject.toml') || has('setup.py') || has('setup.cfg')) {
		return new Set(['dist', 'build']);
	}
	return new Set();
}

export function isIgnoredPath(
	root: string,
	abs: string,
	buildDirs: ReadonlySet<string> = new Set(),
): boolean {
	const rel = relative(root, abs);
	if (!rel || rel.startsWith('..')) return false;
	const parts = rel.split(sep);
	if (buildDirs.has(parts[0] ?? '')) return true;
	return parts.some((part) => ALWAYS_IGNORED.has(part));
}

/** A user-facing reason for a watch error. Never includes paths (they can be absolute). */
export function describeWatchError(error: unknown): string {
	const code =
		error instanceof Error && 'code' in error && typeof error.code === 'string'
			? error.code
			: '';
	if (code === 'EPERM' || code === 'EACCES')
		return 'A folder could not be watched (no permission)';
	if (code === 'EMFILE' || code === 'ENFILE' || code === 'ENOSPC')
		return 'The folder has too many files to watch';
	return code ? `Watching for changes failed (${code})` : 'Watching for changes failed';
}

export interface WatchBatch {
	dirs: string[];
	files: string[];
}

/**
 * Watches the workspace and reports changes in batches: directories whose listing changed
 * (add/remove) and files whose content changed. Batching keeps a `git checkout` of 2 000 files
 * from turning into 2 000 IPC messages.
 */
export class WorkspaceWatcher {
	private watcher: FSWatcher | null = null;
	private dirs = new Set<string>();
	private files = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly onBatch: (batch: WatchBatch) => void,
		private readonly onError: (error: unknown) => void,
		private readonly debounceMs = 150,
	) {}

	start(root: string): void {
		void this.stop();
		const toRel = (abs: string): string => relative(root, abs).split(sep).join('/');
		const buildDirs = buildOutputDirs(root);
		this.watcher = watch(root, {
			ignoreInitial: true,
			ignored: (path) => isIgnoredPath(root, path, buildDirs),
			// Polling-free on Windows (ReadDirectoryChangesW); atomic saves from other editors coalesce.
			atomic: true,
		});
		this.watcher
			.on('add', (p) => this.push(toRel(dirname(p)), toRel(p)))
			.on('unlink', (p) => this.push(toRel(dirname(p)), toRel(p)))
			.on('addDir', (p) => this.push(toRel(dirname(p))))
			.on('unlinkDir', (p) => this.push(toRel(dirname(p))))
			.on('change', (p) => this.push(null, toRel(p)))
			.on('error', (error) => this.onError(error));
	}

	async stop(): Promise<void> {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.dirs.clear();
		this.files.clear();
		const w = this.watcher;
		this.watcher = null;
		await w?.close();
	}

	private push(dir: string | null, file?: string): void {
		if (dir !== null) this.dirs.add(dir === '.' ? '' : dir);
		if (file) this.files.add(file);
		if (this.timer) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			const batch = { dirs: [...this.dirs], files: [...this.files] };
			this.dirs.clear();
			this.files.clear();
			this.onBatch(batch);
		}, this.debounceMs);
	}
}
