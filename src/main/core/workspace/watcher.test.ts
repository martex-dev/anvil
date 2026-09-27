import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SAVE_TEMP_SUFFIX } from './atomic-write';
import {
	buildOutputDirs,
	describeWatchError,
	isIgnoredPath,
	MAX_BATCH_PATHS,
	type WatchBatch,
	WorkspaceWatcher,
} from './watcher';

const errno = (code: string): Error =>
	Object.assign(new Error(`${code}: watch 'C:\\Users\\me\\share'`), { code });

describe('describeWatchError', () => {
	it('explains common watch failures without leaking paths', () => {
		expect(describeWatchError(errno('EPERM'))).toBe(
			'A folder could not be watched (no permission)',
		);
		expect(describeWatchError(errno('EMFILE'))).toBe('The folder has too many files to watch');
		expect(describeWatchError(errno('EIO'))).toBe('Watching for changes failed (EIO)');
		expect(describeWatchError('weird')).toBe('Watching for changes failed');
		expect(describeWatchError(errno('EPERM'))).not.toContain('Users');
	});
});

describe('isIgnoredPath', () => {
	let root: string;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'anvil-watch-'));
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it('always skips heavy folders at any depth', () => {
		const dirs = buildOutputDirs(root);
		expect(isIgnoredPath(root, join(root, 'node_modules'), dirs)).toBe(true);
		expect(isIgnoredPath(root, join(root, 'pkg', '.venv', 'lib'), dirs)).toBe(true);
		expect(isIgnoredPath(root, root, dirs)).toBe(false);
	});

	it('skips the temp files an atomic save writes', () => {
		const dirs = buildOutputDirs(root);
		expect(
			isIgnoredPath(root, join(root, 'src', `.a.py.1f2e3d4c${SAVE_TEMP_SUFFIX}`), dirs),
		).toBe(true);
		expect(isIgnoredPath(root, join(root, 'src', 'a.py'), dirs)).toBe(false);
	});

	it('skips experiment-tracker output and tool caches, but not files named like them', () => {
		const dirs = buildOutputDirs(root);
		for (const noise of ['mlruns', 'wandb', 'lightning_logs', '.ipynb_checkpoints']) {
			expect(isIgnoredPath(root, join(root, 'exp', noise, 'run1', 'meta.yaml'), dirs)).toBe(
				true,
			);
		}
		expect(isIgnoredPath(root, join(root, 'joblib_cache', 'a.pkl'), dirs)).toBe(true);
		expect(isIgnoredPath(root, join(root, 'data', 'price_cache'), dirs)).toBe(false);
	});

	it('skips a venv folder only when it is a virtual environment', () => {
		const dirs = buildOutputDirs(root);
		mkdirSync(join(root, 'venv'));
		mkdirSync(join(root, 'src', 'venv'), { recursive: true });
		writeFileSync(join(root, 'venv', 'pyvenv.cfg'), 'home = C:\\Python312\n');
		expect(isIgnoredPath(root, join(root, 'venv', 'Lib', 'site.py'), dirs)).toBe(true);
		// A source package that happens to be called venv (e.g. tooling that manages them).
		expect(isIgnoredPath(root, join(root, 'src', 'venv', 'create.py'), dirs)).toBe(false);
	});

	it('watches out/, dist/ and build/ in a plain data folder', () => {
		const dirs = buildOutputDirs(root);
		expect(isIgnoredPath(root, join(root, 'out', 'results.csv'), dirs)).toBe(false);
		expect(isIgnoredPath(root, join(root, 'build', 'model.pkl'), dirs)).toBe(false);
	});

	it('skips top-level build output only in JS and Python projects', () => {
		writeFileSync(join(root, 'package.json'), '{}');
		const js = buildOutputDirs(root);
		expect(isIgnoredPath(root, join(root, 'dist', 'index.js'), js)).toBe(true);
		expect(isIgnoredPath(root, join(root, 'out'), js)).toBe(true);
		// Nested folders with these names are user folders, not the project's build output.
		expect(isIgnoredPath(root, join(root, 'research', 'out', 'a.csv'), js)).toBe(false);

		rmSync(join(root, 'package.json'));
		writeFileSync(join(root, 'pyproject.toml'), '');
		const py = buildOutputDirs(root);
		expect(isIgnoredPath(root, join(root, 'build', 'lib'), py)).toBe(true);
		expect(isIgnoredPath(root, join(root, 'out', 'a.csv'), py)).toBe(false);
	});
});

describe('WorkspaceWatcher batches', () => {
	// Drives the batching directly; chokidar itself is not under test here.
	const push = (w: WorkspaceWatcher, dir: string | null, file?: string): void =>
		(w as unknown as { push(dir: string | null, file?: string): void }).push(dir, file);

	it('sends changes in one batch after the debounce', () => {
		vi.useFakeTimers();
		try {
			const batches: WatchBatch[] = [];
			const w = new WorkspaceWatcher((b) => batches.push(b), vi.fn(), 50);
			push(w, 'src', 'src/a.py');
			push(w, null, 'src/a.py');
			vi.advanceTimersByTime(50);
			expect(batches).toEqual([{ dirs: ['src'], files: ['src/a.py'] }]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('turns a flood of changes into one overflow signal', () => {
		vi.useFakeTimers();
		try {
			const batches: WatchBatch[] = [];
			const w = new WorkspaceWatcher((b) => batches.push(b), vi.fn(), 50);
			for (let i = 0; i <= MAX_BATCH_PATHS; i++) push(w, null, `data/part-${i}.parquet`);
			vi.advanceTimersByTime(50);
			expect(batches).toEqual([{ dirs: [], files: [], overflow: true }]);
			// The next batch lists paths again.
			push(w, null, 'a.py');
			vi.advanceTimersByTime(50);
			expect(batches[1]).toEqual({ dirs: [], files: ['a.py'] });
		} finally {
			vi.useRealTimers();
		}
	});
});
