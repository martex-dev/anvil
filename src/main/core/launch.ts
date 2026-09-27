import { statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

/** What a launch asked for: a folder to work in and, optionally, a file in it to show. */
export interface LaunchTarget {
	/** Absolute folder path. */
	folder: string;
	/** The file relative to `folder`, '/'-separated, or null for just the folder. */
	file: string | null;
}

type Kind = 'file' | 'dir' | null;

function kindOf(path: string): Kind {
	try {
		const s = statSync(path);
		return s.isDirectory() ? 'dir' : s.isFile() ? 'file' : null;
	} catch {
		return null;
	}
}

/**
 * The path a launch was given (`Anvil.exe C:\proj`, Explorer's "Open with Anvil", a second
 * start), or null. Packaged, argv is [exe, ...args]; in development it is [electron, '.', ...].
 * Chromium and Electron switches (--foo) are skipped; the last existing path wins.
 */
export function launchPathFromArgv(
	argv: readonly string[],
	cwd: string,
	packaged: boolean,
	kind: (path: string) => Kind = kindOf,
): string | null {
	const args = argv.slice(packaged ? 1 : 2).filter((a) => a !== '' && !a.startsWith('-'));
	for (const arg of [...args].reverse()) {
		const path = resolve(cwd, arg);
		if (kind(path)) return path;
	}
	return null;
}

const inside = (root: string, path: string): string | null => {
	const rel = relative(root, path);
	return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.replace(/\\/g, '/') : null;
};

/**
 * Where a launched path opens: a folder as the workspace; a file inside the current folder in
 * place, otherwise in its own folder.
 */
export function resolveLaunchTarget(
	path: string,
	currentRoot: string | null,
	kind: (path: string) => Kind = kindOf,
): LaunchTarget | null {
	const k = kind(path);
	if (k === 'dir') return { folder: path, file: null };
	if (k !== 'file') return null;
	const rel = currentRoot ? inside(currentRoot, path) : null;
	if (currentRoot && rel) return { folder: currentRoot, file: rel };
	return { folder: dirname(path), file: basename(path) };
}

/** Same folder, ignoring trailing separators, and case on Windows. */
export function sameFolder(
	a: string | null,
	b: string | null,
	caseInsensitive = process.platform === 'win32',
): boolean {
	if (!a || !b) return false;
	const norm = (p: string): string => {
		const clean = resolve(p).replace(/[\\/]+$/, '');
		return caseInsensitive ? clean.toLowerCase() : clean;
	};
	return norm(a) === norm(b);
}
