import {
	Bookmark,
	BookmarkCheck,
	Columns2,
	Eye,
	FilePlus,
	FileX,
	GitCommitHorizontal,
	Save,
	SaveAll,
	Table,
	X,
	ZoomIn,
	ZoomOut,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { getSettings, updateSettings } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { quickPick } from '../../ui/QuickPick';
import { nextBookmarkLine, toggleBookmarkAt } from './extras/bookmarks';
import { isBlameEnabled, setBlameEnabled } from './extras/git-lines';
import { repaintShield } from './extras/shield';
import { saveAll, saveFile } from './file-ops';
import { closeTab } from './open';

function activePath(): string | null {
	const tab = focusedTab(useTabsStore.getState());
	return tab?.path ?? null;
}

async function newFile(): Promise<void> {
	const picked = await quickPick({
		title: 'new file',
		placeholder: 'Path relative to the folder, e.g. src/strategy/momentum.py',
		items: [],
		allowCustom: { label: (text) => `Create ${text}` },
	});
	if (!picked?.startsWith('custom:')) return;
	const rel = picked.slice(7).replace(/\\/g, '/').replace(/^\/+/, '');
	const parts = rel.split('/');
	const name = parts.pop() ?? '';
	let parent = '';
	try {
		for (const dir of parts) {
			const next = parent ? `${parent}/${dir}` : dir;
			// Existing folders are fine; create only what's missing.
			await call('fs:create', { parent, name: dir, kind: 'dir' }).catch(() => undefined);
			parent = next;
		}
		const entry = await call('fs:create', { parent, name, kind: 'file' });
		requestOpenFile({ path: entry.path });
	} catch (error) {
		toast.error(
			'Could not create the file',
			error instanceof Error ? error.message : undefined,
		);
	}
}

export const EDITOR_COMMANDS: Command[] = [
	{
		id: 'file.save',
		title: 'Save',
		category: 'File',
		shortcut: 'Ctrl+S',
		icon: Save,
		run: async () => {
			const path = activePath();
			const tab = focusedTab(useTabsStore.getState());
			if (path && tab?.kind === 'code') await saveFile(path);
		},
	},
	{
		id: 'file.saveAll',
		title: 'Save All',
		category: 'File',
		shortcut: 'Ctrl+Alt+S',
		icon: SaveAll,
		run: saveAll,
	},
	{
		id: 'file.new',
		title: 'New File…',
		category: 'File',
		shortcut: 'Ctrl+N',
		icon: FilePlus,
		run: newFile,
	},
	{
		id: 'file.close',
		title: 'Close Tab',
		category: 'File',
		shortcut: 'Ctrl+W',
		icon: X,
		run: () => {
			const { focused, groups } = useTabsStore.getState();
			const active = groups.find((g) => g.id === focused)?.active;
			if (active) closeTab(focused, active);
		},
	},
	{
		id: 'file.closeAll',
		title: 'Close All Tabs in Group',
		category: 'File',
		icon: FileX,
		run: () => {
			const { focused, groups } = useTabsStore.getState();
			for (const id of [...(groups.find((g) => g.id === focused)?.tabIds ?? [])])
				closeTab(focused, id);
		},
	},
	{
		id: 'view.splitEditor',
		title: 'Split Editor Right',
		category: 'View',
		shortcut: 'Ctrl+\\',
		icon: Columns2,
		run: () => {
			const tab = focusedTab(useTabsStore.getState());
			if (tab) useTabsStore.getState().split(tab.id);
		},
	},
	{
		id: 'view.closeGroup',
		title: 'Close Editor Group',
		category: 'View',
		run: () => useTabsStore.getState().closeGroup(useTabsStore.getState().focused),
	},
	{
		id: 'go.nextTab',
		title: 'Next Tab',
		category: 'Go',
		shortcut: 'Ctrl+PageDown',
		run: () => cycleTab(1),
	},
	{
		id: 'go.prevTab',
		title: 'Previous Tab',
		category: 'Go',
		shortcut: 'Ctrl+PageUp',
		run: () => cycleTab(-1),
	},
	{
		id: 'markdown.preview',
		title: 'Open Markdown Preview to the Side',
		category: 'View',
		shortcut: 'Ctrl+Shift+V',
		icon: Eye,
		run: () => {
			const path = activePath();
			if (!path || !/\.(md|markdown)$/i.test(path)) {
				toast.info('Open a Markdown file first');
				return;
			}
			requestOpenFile({ path, as: 'markdown', side: true });
		},
	},
	{
		id: 'data.openAsTable',
		title: 'Open File as Table',
		category: 'View',
		keywords: ['csv', 'json', 'dataframe', 'grid'],
		icon: Table,
		run: () => {
			const path = activePath();
			if (!path || !/\.(csv|tsv|json|jsonl|ndjson)$/i.test(path)) {
				toast.info('Open a CSV or JSON file first');
				return;
			}
			requestOpenFile({ path, as: 'data' });
		},
	},
	{
		id: 'edit.toggleBookmark',
		title: 'Toggle Bookmark',
		category: 'Edit',
		shortcut: 'Ctrl+Alt+K',
		scope: 'editor',
		icon: Bookmark,
		run: () => {
			const editor = focusedEditor();
			if (editor) toggleBookmarkAt(editor);
		},
	},
	{
		id: 'edit.nextBookmark',
		title: 'Next Bookmark',
		category: 'Go',
		shortcut: 'Ctrl+Alt+L',
		scope: 'editor',
		icon: BookmarkCheck,
		run: () => {
			const editor = focusedEditor();
			const line = editor ? nextBookmarkLine(editor) : null;
			if (editor && line) {
				editor.setPosition({ lineNumber: line, column: 1 });
				editor.revealLineInCenter(line);
			}
		},
	},
	{
		id: 'edit.toggleShield',
		title: 'Toggle Secret Shield',
		category: 'Edit',
		keywords: ['env', 'blur', 'streamer', 'keys', 'privacy'],
		run: async () => {
			const on = !getSettings().secretShield;
			await updateSettings({ secretShield: on });
			repaintShield();
			toast.info(`Secret shield ${on ? 'on' : 'off'}`);
		},
	},
	{
		id: 'git.toggleBlame',
		title: 'Toggle Inline Blame',
		category: 'Git',
		icon: GitCommitHorizontal,
		run: () => {
			setBlameEnabled(!isBlameEnabled());
			toast.info(`Inline blame ${isBlameEnabled() ? 'on' : 'off'}`);
		},
	},
	{
		id: 'view.zoomIn',
		title: 'Editor Font Bigger',
		category: 'View',
		shortcut: 'Ctrl+=',
		icon: ZoomIn,
		run: () =>
			void updateSettings({ editorFontSize: Math.min(24, getSettings().editorFontSize + 1) }),
	},
	{
		id: 'view.zoomOut',
		title: 'Editor Font Smaller',
		category: 'View',
		shortcut: 'Ctrl+-',
		icon: ZoomOut,
		run: () =>
			void updateSettings({ editorFontSize: Math.max(10, getSettings().editorFontSize - 1) }),
	},
	{
		id: 'view.zoomReset',
		title: 'Reset Editor Font Size',
		category: 'View',
		shortcut: 'Ctrl+0',
		run: () => void updateSettings({ editorFontSize: 14 }),
	},
	{
		id: 'file.copyPath',
		title: 'Copy Path of Active File',
		category: 'File',
		run: async () => {
			const model = focusedEditor()?.getModel();
			const path = model ? toWorkspacePath(model.uri) : activePath();
			if (!path) return;
			const text = await call('fs:copyPath', { path, absolute: true });
			await navigator.clipboard.writeText(text);
			toast.success('Path copied', text);
		},
	},
];

function cycleTab(step: number): void {
	const { focused, groups, activate } = useTabsStore.getState();
	const g = groups.find((x) => x.id === focused);
	if (!g || g.tabIds.length === 0) return;
	const i = g.active ? g.tabIds.indexOf(g.active) : 0;
	const next = g.tabIds[(i + step + g.tabIds.length) % g.tabIds.length];
	if (next) activate(focused, next);
}
