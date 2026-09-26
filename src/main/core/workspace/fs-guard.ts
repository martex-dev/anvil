import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { fileNameProblem } from '@shared/fs-names';

import { AnvilError } from '../errors';

/**
 * Converts a workspace-relative path ('' = root, '/'-separated) to an absolute one and refuses
 * anything that would land outside the workspace (`..`, absolute paths, other drives).
 */
export function toAbsolute(root: string, rel: string): string {
	if (rel.includes('\0')) throw new AnvilError('FS_BAD_PATH', 'Path contains a NUL byte');
	const abs = resolve(root, rel);
	const back = relative(root, abs);
	if (back === '..' || back.startsWith(`..${sep}`) || isAbsolute(back)) {
		throw new AnvilError('FS_OUTSIDE_WORKSPACE', 'Path is outside the open folder');
	}
	return abs;
}

export function toRelative(root: string, abs: string): string {
	return relative(root, abs).split(sep).join('/');
}

/**
 * Also resolves symlinks/junctions so a link inside the workspace can't be used to write
 * outside it. Checks the nearest existing ancestor (the target itself may not exist yet).
 */
export function assertRealInside(root: string, abs: string): void {
	const realRoot = realpathSync.native(root);
	let probe = abs;
	for (;;) {
		try {
			const real = realpathSync.native(probe);
			const back = relative(realRoot, real);
			if (back === '..' || back.startsWith(`..${sep}`) || isAbsolute(back)) {
				throw new AnvilError(
					'FS_OUTSIDE_WORKSPACE',
					'Path resolves outside the open folder',
				);
			}
			return;
		} catch (error) {
			if (error instanceof AnvilError) throw error;
			const parent = dirname(probe);
			if (parent === probe) throw error;
			probe = parent;
		}
	}
}

/** Validates a single file/folder name for Windows (the strictest target). */
export function validateName(name: string): void {
	const problem = fileNameProblem(name);
	if (problem) throw new AnvilError('FS_BAD_NAME', problem);
}
