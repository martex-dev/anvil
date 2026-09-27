import { type DragEvent, useState } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { isFolder, parentOf } from './tree-model';

/** Explorer drags carry workspace paths under their own type, never as text. */
export const DRAG_TYPE = 'application/x-anvil-paths';

export interface TreeDnd {
	/** The folder a drag would drop into ('' is the root), or null when nothing is dragged. */
	dropTarget: string | null;
	onDragStart: (event: DragEvent<HTMLElement>) => void;
	onDragOver: (event: DragEvent<HTMLElement>) => void;
	onDragLeave: (event: DragEvent<HTMLElement>) => void;
	onDrop: (event: DragEvent<HTMLElement>) => void;
	onDragEnd: () => void;
}

/** The row (by `data-path`) an event happened on, if any. */
export function rowPath(target: EventTarget | null): string | null {
	const row = target instanceof Element ? target.closest('[data-path]') : null;
	return row?.getAttribute('data-path') ?? null;
}

/** The folder a drop on `path` lands in: the folder itself, or the folder a file is in. */
export function dropFolder(path: string | null, entries: ReadonlyMap<string, FsEntry>): string {
	if (path === null) return '';
	const entry = entries.get(path);
	return entry && isFolder(entry) ? path : parentOf(path);
}

/**
 * Drag and drop between explorer rows: drop moves (Ctrl copies), onto a folder or next to a
 * file. Handlers sit on the tree, found by `data-path`, so rows stay free of callbacks.
 */
export function useTreeDnd(
	entries: ReadonlyMap<string, FsEntry>,
	drop: (mode: 'move' | 'copy', paths: string[], dir: string) => void,
): TreeDnd {
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const carries = (event: DragEvent<HTMLElement>): boolean =>
		event.dataTransfer.types.includes(DRAG_TYPE);

	return {
		dropTarget,
		onDragStart: (event) => {
			const path = rowPath(event.target);
			if (path === null) return;
			event.dataTransfer.setData(DRAG_TYPE, JSON.stringify([path]));
			event.dataTransfer.effectAllowed = 'copyMove';
		},
		onDragOver: (event) => {
			if (!carries(event)) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = event.ctrlKey ? 'copy' : 'move';
			const dir = dropFolder(rowPath(event.target), entries);
			if (dir !== dropTarget) setDropTarget(dir);
		},
		onDragLeave: (event) => {
			// Only when the pointer leaves the tree, not when it crosses from row to row.
			if (!(
				event.relatedTarget instanceof Node &&
				event.currentTarget.contains(event.relatedTarget)
			))
				setDropTarget(null);
		},
		onDrop: (event) => {
			if (!carries(event)) return;
			event.preventDefault();
			setDropTarget(null);
			let paths: unknown;
			try {
				paths = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
			} catch {
				// Not ours after all (another window's malformed payload): nothing to move.
				return;
			}
			if (!Array.isArray(paths)) return;
			const list = paths.filter((p): p is string => typeof p === 'string');
			const dir = dropFolder(rowPath(event.target), entries);
			if (list.length > 0) drop(event.ctrlKey ? 'copy' : 'move', list, dir);
		},
		onDragEnd: () => setDropTarget(null),
	};
}
