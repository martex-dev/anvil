import type { FsEntry } from '@shared/ipc/channels/fs';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { compareWithSelected, selectedForCompare, selectForCompare } from '../editor/compare';
import type { MenuItem } from './ExplorerContextMenu';

interface MenuDeps {
	/** The row that was right-clicked, or null for the empty area below the rows. */
	target: FsEntry | null;
	startCreate: (kind: 'file' | 'dir', target: FsEntry | null) => void;
	rename: (path: string) => void;
	remove: (path: string) => void;
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

/** The Explorer's right-click menu for one target. */
export function explorerMenuItems({
	target,
	startCreate,
	rename,
	remove,
}: MenuDeps): Array<MenuItem | 'separator'> {
	return [
		{ label: 'New File', onSelect: () => startCreate('file', target) },
		{ label: 'New Folder', onSelect: () => startCreate('dir', target) },
		'separator',
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
