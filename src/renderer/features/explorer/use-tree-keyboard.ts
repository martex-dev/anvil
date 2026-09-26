import type { KeyboardEvent } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { isFolder, parentOf, type TreeRow } from './tree-model';

interface KeyboardDeps {
	rows: TreeRow[];
	focused: string | null;
	setFocused: (path: string) => void;
	toggle: (dir: string) => void;
	open: (entry: FsEntry) => void;
	rename: (path: string) => void;
	remove: (path: string) => void;
}

/** Arrow-key navigation following the WAI-ARIA tree pattern. */
export function treeKeyHandler(deps: KeyboardDeps): (event: KeyboardEvent) => void {
	return (event) => {
		const entries = deps.rows.flatMap((r) => (r.kind === 'entry' ? [r] : []));
		if (entries.length === 0) return;
		const index = entries.findIndex((r) => r.entry.path === deps.focused);
		const current = entries[index];
		const move = (i: number): void => {
			const target = entries[Math.max(0, Math.min(entries.length - 1, i))];
			if (target) deps.setFocused(target.entry.path);
		};

		switch (event.key) {
			case 'ArrowDown':
				move(index + 1);
				break;
			case 'ArrowUp':
				move(index === -1 ? 0 : index - 1);
				break;
			case 'Home':
				move(0);
				break;
			case 'End':
				move(entries.length - 1);
				break;
			case 'ArrowRight':
				if (!current || !isFolder(current.entry)) return;
				if (!current.expanded) deps.toggle(current.entry.path);
				else move(index + 1);
				break;
			case 'ArrowLeft':
				if (!current) return;
				if (isFolder(current.entry) && current.expanded) deps.toggle(current.entry.path);
				else if (parentOf(current.entry.path))
					deps.setFocused(parentOf(current.entry.path));
				break;
			case 'Enter':
				if (current) deps.open(current.entry);
				break;
			case 'F2':
				if (current) deps.rename(current.entry.path);
				break;
			case 'Delete':
				if (current) deps.remove(current.entry.path);
				break;
			default:
				return;
		}
		event.preventDefault();
	};
}
