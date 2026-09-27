import { FilePen, History, RotateCcw } from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { call, IpcCallError } from '../../lib/ipc';
import { codeTabId, focusedTab, useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { quickPick } from '../../ui/QuickPick';
import { markDirty, tracked } from './buffers';
import { useEditorStore } from './editor-store';
import { isScratch, reloadFromDisk, saveFile } from './file-ops';
import { splitNewPath } from './new-file';
import { closeTab, takeClosedTab } from './open';

async function exists(rel: string): Promise<boolean> {
	try {
		await call('fs:readFile', rel);
		return true;
	} catch {
		return false;
	}
}

/** Creates the folders on the way to a new file (existing ones are fine). */
async function ensureFolders(dirs: readonly string[]): Promise<string> {
	let parent = '';
	for (const dir of dirs) {
		try {
			await call('fs:create', { parent, name: dir, kind: 'dir' });
		} catch (error) {
			if (!(error instanceof IpcCallError && error.code === 'FS_EXISTS')) throw error;
		}
		parent = parent ? `${parent}/${dir}` : dir;
	}
	return parent;
}

/** Writes the focused buffer to a new path and switches its tab to that file, like VS Code. */
async function saveAs(): Promise<void> {
	const { focused } = useTabsStore.getState();
	const tab = focusedTab(useTabsStore.getState());
	const from = tab?.kind === 'code' ? tab.path : null;
	const t = from ? tracked.get(from) : undefined;
	if (!from || !t) {
		toast.info('Open a file to save it under a new name');
		return;
	}
	const picked = await quickPick({
		title: 'save as',
		placeholder: 'New path relative to the folder, e.g. research/momentum_v2.py',
		items: [],
		initialQuery: isScratch(from) ? 'scratch.py' : from,
		allowCustom: { label: (text) => `Save as ${text}` },
	});
	if (!picked?.startsWith('custom:')) return;
	const split = splitNewPath(picked.slice(7));
	if (!split || split.dirs.some((d) => d === '.' || d === '..')) {
		toast.warn('Enter a file path inside the folder', 'e.g. research/momentum_v2.py');
		return;
	}
	const to = [...split.dirs, split.name].join('/');
	if (to === from) {
		await saveFile(from, false);
		return;
	}
	if (await exists(to)) {
		const answer = await quickPick({
			title: `${to} already exists`,
			placeholder: 'Replace it?',
			items: [
				{ id: 'replace', label: 'Replace', description: 'Overwrite the existing file' },
				{ id: 'cancel', label: 'Cancel' },
			],
		});
		if (answer !== 'replace') return;
	}
	try {
		await ensureFolders(split.dirs);
		// Same bytes on disk as a save would write: the buffer's BOM and encoding come along.
		await call('fs:writeFile', {
			path: to,
			content: t.model.getValue(),
			bom: t.bom,
			encoding: t.encoding,
		});
	} catch (error) {
		toast.error(`Could not save ${to}`, error instanceof Error ? error.message : undefined);
		return;
	}
	requestOpenFile({ path: to });
	if (isScratch(from)) return;
	// The old file keeps what's on disk; its unsaved edits now live in the new one.
	t.savedVersion = t.model.getAlternativeVersionId();
	markDirty(from);
	closeTab(focused, codeTabId(from));
}

export const FILE_COMMANDS: Command[] = [
	{
		id: 'file.saveAs',
		title: 'Save As…',
		category: 'File',
		shortcut: 'Ctrl+Shift+S',
		icon: FilePen,
		run: saveAs,
	},
	{
		id: 'file.revert',
		title: 'Revert File',
		category: 'File',
		icon: RotateCcw,
		run: async () => {
			const tab = focusedTab(useTabsStore.getState());
			const path = tab?.kind === 'code' ? tab.path : null;
			const file = useEditorStore.getState().files.find((f) => f.path === path);
			if (!path || !file || isScratch(path)) return;
			// Undoable: Ctrl+Z brings the edits back.
			await reloadFromDisk(path);
		},
	},
	{
		id: 'file.reopenClosed',
		title: 'Reopen Closed Tab',
		category: 'File',
		shortcut: 'Ctrl+Shift+T',
		icon: History,
		run: () => {
			const entry = takeClosedTab();
			if (!entry) {
				toast.info('No closed tabs to reopen');
				return;
			}
			const as =
				entry.kind === 'code' || entry.kind === 'data' || entry.kind === 'markdown'
					? entry.kind
					: undefined;
			requestOpenFile({ path: entry.path, ...(as ? { as } : {}) });
		},
	},
	{
		id: 'file.closeSaved',
		title: 'Close Saved Tabs in Group',
		category: 'File',
		run: () => {
			const { focused, groups, tabs } = useTabsStore.getState();
			const files = useEditorStore.getState().files;
			for (const id of [...(groups.find((g) => g.id === focused)?.tabIds ?? [])]) {
				const path = tabs[id]?.path;
				if (!files.some((f) => f.path === path && f.dirty)) closeTab(focused, id);
			}
		},
	},
];
