import {
	FilePlus,
	FolderMinus,
	FolderPlus,
	History,
	LocateFixed,
	Pencil,
	RefreshCw,
	Trash2,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { WORKSPACE_KEY } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { withExplorerTree } from './explorer-tree-registry';
import { openRecentFolder, refreshExplorer } from './workspace-actions';

async function openRecent(): Promise<void> {
	const info = await queryClient.ensureQueryData({
		queryKey: WORKSPACE_KEY,
		queryFn: () => call('workspace:get'),
	});
	if (info.recent.length === 0) {
		toast.info('No recent folders yet');
		return;
	}
	const picked = await quickPick({
		title: 'recent folders',
		placeholder: 'Open a recent folder',
		items: info.recent.map((path) => ({
			id: path,
			label: path.split(/[\\/]/).at(-1) ?? path,
			description: path,
			current: path === info.root,
		})),
	});
	if (picked) openRecentFolder(picked);
}

export const EXPLORER_COMMANDS: Command[] = [
	{
		id: 'file.openRecent',
		title: 'Open Recent Folder…',
		category: 'File',
		keywords: ['project', 'workspace', 'history'],
		icon: History,
		run: openRecent,
	},
	{
		id: 'explorer.newFile',
		title: 'New File in Explorer',
		category: 'File',
		icon: FilePlus,
		run: () => withExplorerTree((tree) => tree.startCreate('file')),
	},
	{
		id: 'explorer.newFolder',
		title: 'New Folder in Explorer',
		category: 'File',
		icon: FolderPlus,
		keywords: ['directory', 'mkdir'],
		run: () => withExplorerTree((tree) => tree.startCreate('dir')),
	},
	{
		id: 'explorer.rename',
		title: 'Rename Selected Explorer Item',
		category: 'File',
		icon: Pencil,
		run: () => withExplorerTree((tree) => tree.renameFocused()),
	},
	{
		id: 'explorer.delete',
		title: 'Delete Selected Explorer Item',
		category: 'File',
		icon: Trash2,
		keywords: ['remove', 'recycle bin', 'trash'],
		run: () => withExplorerTree((tree) => tree.deleteFocused()),
	},
	{
		id: 'explorer.refresh',
		title: 'Refresh Explorer',
		category: 'View',
		keywords: ['reload', 'watch', 'out of date'],
		icon: RefreshCw,
		// Works with the Explorer hidden too, and restarts file watching after a watch error.
		run: refreshExplorer,
	},
	{
		id: 'explorer.collapseAll',
		title: 'Collapse Folders in Explorer',
		category: 'View',
		icon: FolderMinus,
		run: () => withExplorerTree((tree) => tree.collapseAll()),
	},
	{
		id: 'explorer.revealActiveFile',
		title: 'Reveal Active File in Explorer',
		category: 'View',
		icon: LocateFixed,
		keywords: ['locate', 'show', 'find'],
		run: () => withExplorerTree((tree) => tree.revealActive()),
	},
];
