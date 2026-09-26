import type { FsEntry } from '@shared/ipc/channels/fs';

import { call } from '../../lib/ipc';
import { compareWithSelected, selectedForCompare, selectForCompare } from '../editor/compare';
import type { MenuItem } from './ExplorerContextMenu';

interface MenuDeps {
	/** The row that was right-clicked, or null for the empty area below the rows. */
	target: FsEntry | null;
	startCreate: (kind: 'file' | 'dir', target: FsEntry | null) => void;
	rename: (path: string) => void;
	remove: (path: string) => void;
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
			label: 'Copy Relative Path',
			disabled: !target,
			onSelect: () => target && void navigator.clipboard.writeText(target.path),
		},
		{
			label: 'Reveal in File Explorer',
			onSelect: () => void call('fs:reveal', target?.path ?? '').catch(() => undefined),
		},
		'separator',
		{
			label: 'Select for Compare',
			disabled: target?.kind !== 'file',
			onSelect: () => target && selectForCompare(target.path),
		},
		{
			label: 'Compare with Selected',
			disabled: target?.kind !== 'file' || !selectedForCompare(),
			onSelect: () => target && void compareWithSelected(target.path),
		},
	];
}
