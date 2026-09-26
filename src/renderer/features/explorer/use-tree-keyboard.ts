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
	/** Adds a typed character to the type-ahead buffer and returns the whole buffer. */
	typeAhead: (char: string) => string;
}

/** How long a pause ends a type-ahead word, like in native trees. */
const TYPE_AHEAD_RESET_MS = 500;

/** A type-ahead buffer that starts over after a short pause in typing. */
export function createTypeAhead(now: () => number = Date.now): (char: string) => string {
	let buffer = '';
	let last = 0;
	return (char) => {
		const time = now();
		buffer = time - last > TYPE_AHEAD_RESET_MS ? char : buffer + char;
		last = time;
		return buffer;
	};
}

/** Arrow-key navigation following the WAI-ARIA tree pattern. */
export function treeKeyHandler(deps: KeyboardDeps): (event: KeyboardEvent) => void {
	return (event) => {
		// Modified keys belong to app shortcuts, not tree navigation.
		if (event.ctrlKey || event.altKey || event.metaKey) return;
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
			default: {
				// Type-ahead: printable keys jump to the next visible item whose name starts with
				// what was typed. A single key cycles through the matches; a word stays on a match.
				if (event.key.length !== 1) return;
				const prefix = deps.typeAhead(event.key).toLowerCase();
				if (!prefix.trim()) return; // A lone space is not a search.
				const start = prefix.length === 1 ? index + 1 : Math.max(index, 0);
				for (let step = 0; step < entries.length; step++) {
					const candidate = entries[(start + step) % entries.length];
					if (candidate?.entry.name.toLowerCase().startsWith(prefix)) {
						deps.setFocused(candidate.entry.path);
						break;
					}
				}
			}
		}
		event.preventDefault();
	};
}
