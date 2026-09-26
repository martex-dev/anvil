import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildOutputDirs, describeWatchError, isIgnoredPath } from './watcher';

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
