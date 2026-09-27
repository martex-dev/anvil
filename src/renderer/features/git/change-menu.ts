import type { GitChange } from '@shared/ipc/channels/git';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import type { MenuItem } from '../../ui/ContextMenu';
import { copyPath, revealInExplorer } from '../editor/tab-actions';

export interface ChangeMenuHandlers {
	openDiff: () => void;
	toggle: () => void;
	/** Unstaged, non-conflicted rows only. */
	discard?: (() => void) | undefined;
}

async function revealInOs(path: string): Promise<void> {
	try {
		await call('fs:reveal', path);
	} catch (error) {
		toast.error(
			'Could not reveal the file',
			error instanceof Error ? error.message : undefined,
		);
	}
}

/**
 * The right-click menu of a change-list row. File actions need the file inside the open folder
 * (`workspacePath`), and a deleted file has nothing on disk to open or reveal.
 */
export function changeMenuItems(
	change: GitChange,
	staged: boolean,
	handlers: ChangeMenuHandlers,
): Array<MenuItem | 'separator'> {
	const path = change.workspacePath;
	const onDisk = path !== null && change.kind !== 'deleted';
	return [
		{
			label: 'Open File',
			disabled: !onDisk,
			onSelect: () => {
				if (path) requestOpenFile({ path });
			},
		},
		{ label: 'Open Changes', onSelect: handlers.openDiff },
		'separator',
		{ label: staged ? 'Unstage' : 'Stage', onSelect: handlers.toggle },
		...(handlers.discard
			? [
					{
						label: change.kind === 'untracked' ? 'Delete File…' : 'Discard Changes…',
						danger: true,
						onSelect: handlers.discard,
					},
				]
			: []),
		'separator',
		{
			label: 'Copy Path',
			disabled: path === null,
			onSelect: () => {
				if (path) void copyPath(path, true);
			},
		},
		{
			label: 'Copy Relative Path',
			disabled: path === null,
			onSelect: () => {
				if (path) void copyPath(path, false);
			},
		},
		{
			label: 'Reveal in Explorer View',
			disabled: !onDisk,
			onSelect: () => {
				if (path) revealInExplorer(path);
			},
		},
		{
			label: 'Reveal in File Explorer',
			disabled: !onDisk,
			onSelect: () => {
				if (path) void revealInOs(path);
			},
		},
	];
}
