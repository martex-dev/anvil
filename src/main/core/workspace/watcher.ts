import { dirname, relative, sep } from 'node:path';

import { type FSWatcher, watch } from 'chokidar';

/** Heavy or generated folders that would flood the watcher and the tree. */
export const IGNORED_DIRS = new Set([
	'node_modules',
	'.git',
	'.venv',
	'venv',
	'__pycache__',
	'.pytest_cache',
	'.ruff_cache',
	'.mypy_cache',
	'out',
	'dist',
	'build',
	'.next',
	'.turbo',
	'.cache',
]);

export function isIgnoredPath(root: string, abs: string): boolean {
	const rel = relative(root, abs);
	if (!rel || rel.startsWith('..')) return false;
	return rel.split(sep).some((part) => IGNORED_DIRS.has(part));
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
		this.watcher = watch(root, {
			ignoreInitial: true,
			ignored: (path) => isIgnoredPath(root, path),
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
