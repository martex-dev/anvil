import { existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { type FSWatcher, watch } from 'chokidar';

import { SAVE_TEMP_SUFFIX } from './atomic-write';

/** Heavy or generated folders that would flood the watcher and the tree, at any depth. */
const ALWAYS_IGNORED = new Set([
	'node_modules',
	'.git',
	'.venv',
	'__pycache__',
	'.pytest_cache',
	'.ruff_cache',
	'.mypy_cache',
	'.next',
	'.turbo',
	'.cache',
	// Experiment trackers and notebooks write here constantly during a training run.
	'mlruns',
	'wandb',
	'lightning_logs',
	'.ipynb_checkpoints',
]);

/** `venv` is the usual virtualenv name, but only a folder with pyvenv.cfg really is one. */
const VENV_NAME = 'venv';

/** Folder names that are build output in JS/Python projects, but often data folders elsewhere. */
const BUILD_OUTPUT = ['out', 'dist', 'build'];

/**
 * More changed paths than this in one batch (a checkout, an unzip, a training run's
 * checkpoints) are sent as a single "refresh everything" signal instead of a huge message.
 */
export const MAX_BATCH_PATHS = 2_000;

/** Tool caches (`joblib_cache`, `.hypothesis_cache`...), named by the common suffix. */
const isCacheDir = (name: string): boolean => name.endsWith('_cache');

/** Whether a folder is a Python virtual environment; cached per watch, stat'ing once. */
export function venvChecker(): (dir: string) => boolean {
	const known = new Map<string, boolean>();
	return (dir) => {
		let answer = known.get(dir);
		if (answer === undefined) {
			answer = existsSync(join(dir, 'pyvenv.cfg'));
			known.set(dir, answer);
		}
		return answer;
	};
}

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
	isVenv: (dir: string) => boolean = venvChecker(),
): boolean {
	const rel = relative(root, abs);
	if (!rel || rel.startsWith('..')) return false;
	// A save's temp file lives for milliseconds; reporting it would only flicker the tree.
	if (rel.endsWith(SAVE_TEMP_SUFFIX)) return true;
	const parts = rel.split(sep);
	if (buildDirs.has(parts[0] ?? '')) return true;
	return parts.some((part, i) => {
		if (ALWAYS_IGNORED.has(part)) return true;
		// The last part may be a file; only folders above it are caches or environments.
		if (i === parts.length - 1) return false;
		if (isCacheDir(part)) return true;
		return part === VENV_NAME && isVenv(join(root, ...parts.slice(0, i + 1)));
	});
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
	/** Too many changes to list: every listing and open file should be refreshed. */
	overflow?: true;
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
	private overflow = false;
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
		const isVenv = venvChecker();
		this.watcher = watch(root, {
			ignoreInitial: true,
			ignored: (path) => isIgnoredPath(root, path, buildDirs, isVenv),
			// Polling-free on Windows (ReadDirectoryChangesW); atomic saves from other editors coalesce.
			atomic: true,
			// A locked system folder (or one the user can't read) is skipped, not a watch error.
			ignorePermissionErrors: true,
			// A link to a big data folder elsewhere would be watched in full (and a link back up
			// the tree forever); the link itself is still reported.
			followSymlinks: false,
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
		this.overflow = false;
		const w = this.watcher;
		this.watcher = null;
		await w?.close();
	}

	private push(dir: string | null, file?: string): void {
		if (!this.overflow) {
			if (dir !== null) this.dirs.add(dir === '.' ? '' : dir);
			if (file) this.files.add(file);
			if (this.dirs.size + this.files.size > MAX_BATCH_PATHS) {
				// Past this point listing paths costs more than refreshing everything once.
				this.overflow = true;
				this.dirs.clear();
				this.files.clear();
			}
		}
		if (this.timer) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			const batch: WatchBatch = this.overflow
				? { dirs: [], files: [], overflow: true }
				: { dirs: [...this.dirs], files: [...this.files] };
			this.dirs.clear();
			this.files.clear();
			this.overflow = false;
			this.onBatch(batch);
		}, this.debounceMs);
	}
}
