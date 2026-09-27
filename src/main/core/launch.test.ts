import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { launchPathFromArgv, resolveLaunchTarget, sameFolder } from './launch';

const root = resolve('/work/proj');
const kinds: Record<string, 'file' | 'dir'> = {
	[root]: 'dir',
	[join(root, 'src', 'a.py')]: 'file',
	[resolve('/elsewhere/notes.md')]: 'file',
	[resolve('/work/other')]: 'dir',
};
const kind = (p: string): 'file' | 'dir' | null => kinds[p] ?? null;

describe('launchPathFromArgv', () => {
	it('takes the path after the exe when packaged, skipping switches', () => {
		expect(
			launchPathFromArgv(['Anvil.exe', '--allow-file-access', 'src/a.py'], root, true, kind),
		).toBe(join(root, 'src', 'a.py'));
	});

	it("skips electron and the app folder ('.') in development", () => {
		expect(
			launchPathFromArgv(['electron.exe', '.', '--user-data-dir=x'], root, false, kind),
		).toBe(null);
		expect(launchPathFromArgv(['electron.exe', '.', root], '/', false, kind)).toBe(root);
	});

	it('ignores paths that do not exist', () => {
		expect(launchPathFromArgv(['Anvil.exe', 'nope.py'], root, true, kind)).toBe(null);
	});
});

describe('resolveLaunchTarget', () => {
	it('opens a folder as the workspace', () => {
		expect(resolveLaunchTarget(resolve('/work/other'), root, kind)).toEqual({
			folder: resolve('/work/other'),
			file: null,
		});
	});

	it('opens a file inside the current folder in place', () => {
		expect(resolveLaunchTarget(join(root, 'src', 'a.py'), root, kind)).toEqual({
			folder: root,
			file: 'src/a.py',
		});
	});

	it('opens a file elsewhere in its own folder', () => {
		expect(resolveLaunchTarget(resolve('/elsewhere/notes.md'), root, kind)).toEqual({
			folder: resolve('/elsewhere'),
			file: 'notes.md',
		});
	});
});

describe('sameFolder', () => {
	it('ignores case on Windows and trailing separators', () => {
		expect(sameFolder('C:\\Proj\\', 'c:\\proj', true)).toBe(true);
		expect(sameFolder('/a/Proj', '/a/proj', false)).toBe(false);
		expect(sameFolder(null, '/a')).toBe(false);
	});
});
