import { fileNameProblem } from '@shared/fs-names';
import type { FsEntry } from '@shared/ipc/channels/fs';

export type TreeRow =
	| { kind: 'entry'; entry: FsEntry; depth: number; expanded: boolean }
	| { kind: 'loading'; dir: string; depth: number }
	| { kind: 'error'; dir: string; depth: number; message: string }
	| { kind: 'input'; parent: string; depth: number; create: 'file' | 'dir' };

export interface DirState {
	entries?: FsEntry[];
	error?: string;
}

export interface PendingCreate {
	parent: string;
	kind: 'file' | 'dir';
}

/** Folders and links that point at folders (junctions, pnpm links) expand like folders. */
export function isFolder(entry: FsEntry): boolean {
	return entry.kind === 'dir' || (entry.kind === 'symlink' && entry.targetKind === 'dir');
}

/** Flattens the visible part of the tree (root + expanded folders) into rows for rendering. */
export function buildRows(
	dirs: ReadonlyMap<string, DirState>,
	expanded: ReadonlySet<string>,
	pending: PendingCreate | null = null,
): TreeRow[] {
	const rows: TreeRow[] = [];
	const walk = (dir: string, depth: number): void => {
		if (pending && pending.parent === dir) {
			rows.push({ kind: 'input', parent: dir, depth, create: pending.kind });
		}
		const state = dirs.get(dir);
		if (!state || (!state.entries && !state.error)) {
			rows.push({ kind: 'loading', dir, depth });
			return;
		}
		if (state.error) {
			rows.push({ kind: 'error', dir, depth, message: state.error });
			return;
		}
		for (const entry of state.entries ?? []) {
			const isOpen = isFolder(entry) && expanded.has(entry.path);
			rows.push({ kind: 'entry', entry, depth, expanded: isOpen });
			if (isOpen) walk(entry.path, depth + 1);
		}
	};
	walk('', 0);
	return rows;
}

export function parentOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

/** Every ancestor folder of `path`, outermost first — used to reveal a file in the tree. */
export function ancestorsOf(path: string): string[] {
	const parts = path.split('/').slice(0, -1);
	return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}

export function joinPath(dir: string, name: string): string {
	return dir ? `${dir}/${name}` : name;
}

/** `path` itself or anything inside it (a deleted folder takes its children with it). */
export function isWithin(path: string, ancestor: string): boolean {
	return path === ancestor || path.startsWith(`${ancestor}/`);
}

/**
 * The entry that should take focus once `path` is removed: the next visible entry outside it,
 * else the previous one, else null when nothing is left.
 */
export function neighbourAfterRemoval(rows: readonly TreeRow[], path: string): string | null {
	const paths = rows.flatMap((r) => (r.kind === 'entry' ? [r.entry.path] : []));
	const index = paths.indexOf(path);
	if (index === -1) return null;
	const after = paths.slice(index + 1).find((p) => !isWithin(p, path));
	return after ?? paths[index - 1] ?? null;
}

/** Names of the visible entries directly inside `dir`, leaving out `except` (a renamed item). */
export function siblingNames(rows: readonly TreeRow[], dir: string, except?: string): string[] {
	return rows.flatMap((r) =>
		r.kind === 'entry' && r.entry.path !== except && parentOf(r.entry.path) === dir
			? [r.entry.name]
			: [],
	);
}

/**
 * Why `name` can't be used for a new or renamed item next to `siblings`, or null. Windows
 * names are case-insensitive, so "Data.csv" clashes with "data.csv".
 */
export function newNameProblem(name: string, siblings: readonly string[]): string | null {
	const lower = name.toLowerCase();
	return (
		fileNameProblem(name) ??
		(siblings.some((s) => s.toLowerCase() === lower) ? `"${name}" already exists` : null)
	);
}
