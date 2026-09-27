import type { FsEntry } from '@shared/ipc/channels/fs';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { compareWithSelected, selectedForCompare, selectForCompare } from '../editor/compare';
import type { MenuItem } from './ExplorerContextMenu';
import { isFolder, parentOf } from './tree-model';

/** What the menu can do to entries; built by the tree, which owns focus and the clipboard. */
export interface EntryActions {
	openToSide: (path: string) => void;
	/** Opens a terminal in `dir` (workspace-relative, '' for the root). */
	openInTerminal: (dir: string) => void;
	runPython: (path: string) => void;
	cut: (path: string) => void;
	copy: (path: string) => void;
	/** Pastes what was cut or copied into `dir`; `canPaste` says whether there is anything. */
	paste: (dir: string) => void;
	canPaste: boolean;
	duplicate: (path: string) => void;
}

interface MenuDeps {
	/** The row that was right-clicked, or null for the empty area below the rows. */
	target: FsEntry | null;
	startCreate: (kind: 'file' | 'dir', target: FsEntry | null) => void;
	rename: (path: string) => void;
	remove: (path: string) => void;
	actions?: EntryActions | undefined;
}

/** Copies a workspace path (absolute, or relative with OS separators) and confirms it. */
export async function copyEntryPath(path: string, absolute: boolean): Promise<void> {
	try {
		const text = await call('fs:copyPath', { path, absolute });
		await navigator.clipboard.writeText(text);
		toast.success('Path copied', text);
	} catch (error) {
		toast.error('Could not copy path', error instanceof Error ? error.message : undefined);
	}
}

/** Open to the Side, Run, Open in Terminal: what a right-click on a row is most often for. */
function openItems(target: FsEntry | null, actions: EntryActions): MenuItem[] {
	const file = target?.kind === 'file' ? target : null;
	// A file's terminal opens in its folder; empty space means the folder root.
	const dir = !target ? '' : isFolder(target) ? target.path : parentOf(target.path);
	return [
		...(file
			? [{ label: 'Open to the Side', onSelect: () => actions.openToSide(file.path) }]
			: []),
		...(file?.name.toLowerCase().endsWith('.py')
			? [{ label: 'Run Python File', onSelect: () => actions.runPython(file.path) }]
			: []),
		{ label: 'Open in Terminal', onSelect: () => actions.openInTerminal(dir) },
	];
}

function clipboardItems(target: FsEntry | null, actions: EntryActions): MenuItem[] {
	const dir = !target ? '' : isFolder(target) ? target.path : parentOf(target.path);
	return [
		{
			label: 'Cut',
			shortcut: 'Ctrl+X',
			disabled: !target,
			onSelect: () => target && actions.cut(target.path),
		},
		{
			label: 'Copy',
			shortcut: 'Ctrl+C',
			disabled: !target,
			onSelect: () => target && actions.copy(target.path),
		},
		{
			label: 'Paste',
			shortcut: 'Ctrl+V',
			disabled: !actions.canPaste,
			onSelect: () => actions.paste(dir),
		},
		{
			label: 'Duplicate',
			disabled: !target,
			onSelect: () => target && actions.duplicate(target.path),
		},
	];
}

/** The Explorer's right-click menu for one target. */
export function explorerMenuItems({
	target,
	startCreate,
	rename,
	remove,
	actions,
}: MenuDeps): Array<MenuItem | 'separator'> {
	return [
		...(actions ? [...openItems(target, actions), 'separator' as const] : []),
		{ label: 'New File', onSelect: () => startCreate('file', target) },
		{ label: 'New Folder', onSelect: () => startCreate('dir', target) },
		'separator',
		...(actions ? [...clipboardItems(target, actions), 'separator' as const] : []),
		{
			label: 'Rename',
			shortcut: 'F2',
			disabled: !target,
			onSelect: () => target && rename(target.path),
		},
		{
			label: 'Delete',
			shortcut: 'Delete',
			danger: true,
			disabled: !target,
			onSelect: () => target && remove(target.path),
		},
		'separator',
		{
			label: 'Copy Path',
			onSelect: () => void copyEntryPath(target?.path ?? '', true),
		},
		{
			label: 'Copy Relative Path',
			disabled: !target,
			onSelect: () => target && void copyEntryPath(target.path, false),
		},
		{
			label: 'Reveal in File Explorer',
			onSelect: () =>
				void call('fs:reveal', target?.path ?? '').catch((error: unknown) =>
					toast.error(
						'Could not reveal in File Explorer',
						error instanceof Error ? error.message : undefined,
					),
				),
		},
		'separator',
		{
			label: 'Select for Compare',
			disabled: target?.kind !== 'file',
			onSelect: () => target && selectForCompare(target.path),
		},
		{
			label: 'Compare with Selected',
			disabled:
				target?.kind !== 'file' ||
				!selectedForCompare() ||
				selectedForCompare() === target.path,
			onSelect: () => target && void compareWithSelected(target.path),
		},
	];
}
