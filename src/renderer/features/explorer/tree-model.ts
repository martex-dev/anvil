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
			const isOpen = entry.kind === 'dir' && expanded.has(entry.path);
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
