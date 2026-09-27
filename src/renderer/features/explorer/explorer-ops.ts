import type { FsEntry } from '@shared/ipc/channels/fs';

import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { call, IpcCallError } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { renameOpenPath } from '../editor/rename';
import { isWithin, joinPath, parentOf } from './tree-model';

/** The parts of a typed name: `a/b.py` (or `a\b.py`) creates folder `a` with `b.py` in it. */
export function nameParts(name: string): string[] {
	return name.split(/[\\/]/).map((p) => p.trim());
}

const exists = (error: unknown): boolean =>
	error instanceof IpcCallError && error.code === 'FS_EXISTS';

/**
 * Creates `name` inside `parent`, making any folders a nested name like `models/lstm/net.py`
 * passes through (existing ones are reused). Rejects with main's reason, e.g. when the final
 * item already exists.
 */
export async function createPath(
	parent: string,
	name: string,
	kind: 'file' | 'dir',
): Promise<FsEntry> {
	const parts = nameParts(name);
	const last = parts.pop() ?? '';
	let dir = parent;
	for (const folder of parts) {
		try {
			await call('fs:create', { parent: dir, name: folder, kind: 'dir' });
		} catch (error) {
			if (!exists(error)) throw error;
		}
		dir = joinPath(dir, folder);
	}
	return call('fs:create', { parent: dir, name: last, kind });
}

/**
 * Why `paths` can't be moved or copied into `target`, or null. A folder never goes into itself
 * or its own subfolder; moving into the folder an item is already in does nothing.
 */
export function transferProblem(
	mode: 'move' | 'copy',
	paths: readonly string[],
	target: string,
): string | null {
	if (paths.length === 0) return 'Nothing to paste';
	if (paths.some((p) => isWithin(target, p))) return 'A folder cannot be put inside itself';
	if (mode === 'move' && paths.every((p) => parentOf(p) === target))
		return 'Already in this folder';
	return null;
}

/** Asks before a move replaces an item of the same name (which then goes to the Recycle Bin). */
async function confirmReplace(name: string, target: string): Promise<boolean> {
	const answer = await quickPick({
		title: `"${name}" already exists in ${target || 'the folder root'}`,
		placeholder: 'The one there goes to the Recycle Bin',
		items: [
			{ id: 'replace', label: `Replace "${name}"` },
			{ id: 'skip', label: 'Skip this item' },
		],
	});
	return answer === 'replace';
}

/**
 * Moves (`move`) or copies (`copy`) `paths` into the folder `target`, one at a time so each clash
 * can be answered. Open tabs follow moved files. Returns the resulting entries; failures are
 * reported as toasts and don't stop the rest.
 */
export async function transferPaths(
	root: string,
	mode: 'move' | 'copy',
	paths: readonly string[],
	target: string,
): Promise<FsEntry[]> {
	const problem = transferProblem(mode, paths, target);
	if (problem) {
		toast.info(mode === 'move' ? 'Not moved' : 'Not copied', problem);
		return [];
	}
	const done: FsEntry[] = [];
	// A folder and something inside it: moving the folder takes the rest along.
	const tops = paths.filter((p) => !paths.some((q) => q !== p && isWithin(p, q)));
	for (const path of tops) {
		try {
			const entry = await transferOne(root, mode, path, target);
			if (entry) done.push(entry);
		} catch (error) {
			toast.error(
				mode === 'move' ? `Could not move ${path}` : `Could not copy ${path}`,
				error instanceof Error ? error.message : undefined,
			);
		}
	}
	for (const dir of new Set([target, ...tops.map(parentOf)]))
		void queryClient.invalidateQueries({ queryKey: fsKeys.list(root, dir) });
	return done;
}

async function transferOne(
	root: string,
	mode: 'move' | 'copy',
	path: string,
	target: string,
): Promise<FsEntry | null> {
	if (mode === 'copy') return call('fs:copy', { path, targetDir: target });
	let entry: FsEntry;
	try {
		entry = await call('fs:move', { path, targetDir: target });
	} catch (error) {
		const name = path.slice(path.lastIndexOf('/') + 1);
		if (!exists(error) || !(await confirmReplace(name, target))) {
			if (exists(error)) return null;
			throw error;
		}
		entry = await call('fs:move', { path, targetDir: target, overwrite: true });
	}
	// Open tabs and unsaved buffers follow the file (or everything in a moved folder).
	if (entry.path !== path) renameOpenPath(root, path, entry.path);
	return entry;
}
