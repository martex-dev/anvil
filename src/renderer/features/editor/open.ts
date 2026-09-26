import { getSettings } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { loadMonaco } from '../../lib/monaco/load';
import { codeTabId, type Tab, type TabKind, useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import type { OpenFileRequest } from '../../stores/workbench-store';
import { useEditorStore } from './editor-store';
import { closeFile, openFile } from './file-ops';

const DATA = /\.(csv|tsv|tab|parquet|feather|arrow|ipc|jsonl|ndjson|xlsx)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;
const NOTEBOOK = /\.ipynb$/i;

export function kindForPath(path: string): TabKind {
	if (NOTEBOOK.test(path)) return 'notebook';
	if (IMAGE.test(path)) return 'image';
	if (DATA.test(path)) return 'data';
	return 'code';
}

export const baseName = (path: string): string => path.split('/').at(-1) ?? path;

export function tabFor(path: string, kind: TabKind, preview = false): Tab {
	const title = kind === 'markdown' ? `Preview ${baseName(path)}` : baseName(path);
	const id = kind === 'code' ? codeTabId(path) : `${kind}:${path}`;
	return { id, kind, path, title, preview };
}

export const editorPrefs = (): Parameters<typeof loadMonaco>[0] => getSettings();

/** Opens a file in the right viewer: text in Monaco, tables in the grid, images, notebooks. */
export async function openPath(root: string, request: OpenFileRequest): Promise<void> {
	const kind: TabKind = request.as ?? kindForPath(request.path);
	const tabs = useTabsStore.getState();
	let group: number | undefined;
	if (request.side) {
		const other = tabs.groups.find((g) => g.id !== tabs.focused);
		if (!other) {
			const current = tabFor(request.path, kind);
			tabs.open(current);
			tabs.split(current.id);
			group = useTabsStore.getState().focused;
		} else group = other.id;
	}
	const tab = tabFor(request.path, kind, request.preview ?? false);
	if (kind !== 'code') {
		tabs.open(tab, group === undefined ? {} : { group });
		return;
	}
	useEditorStore
		.getState()
		.setReveal(
			request.line
				? { path: request.path, line: request.line, column: request.column ?? 1 }
				: null,
		);
	tabs.open(tab, group === undefined ? {} : { group });
	try {
		const monaco = await loadMonaco(editorPrefs());
		await openFile(monaco, root, request.path);
	} catch (error) {
		rlog.error('editor', 'editor failed to load', error);
		toast.error(
			'The editor failed to load',
			error instanceof Error ? error.message : undefined,
		);
	}
}

/**
 * Closes a tab in one group. A code buffer is released only when no group shows it any more,
 * and a dirty one asks first (EditorDialogs).
 */
export function closeTab(group: number, id: string): void {
	const tabs = useTabsStore.getState();
	const tab = tabs.tabs[id];
	if (!tab) return;
	const shownElsewhere = tabs.groups.some((g) => g.id !== group && g.tabIds.includes(id));
	if (tab.kind === 'code' && tab.path && !shownElsewhere) {
		const file = useEditorStore.getState().files.find((f) => f.path === tab.path);
		if (file?.dirty) {
			useEditorStore.getState().setClosing(tab.path);
			return;
		}
		tabs.close(group, id);
		closeFile(tab.path);
		return;
	}
	tabs.close(group, id);
	if (tab.kind === 'data' && tab.path) void call('data:evict', tab.path).catch(() => undefined);
}

/** Called once a dirty buffer is saved or discarded from the close dialog. */
export function finishClose(path: string): void {
	const id = codeTabId(path);
	for (const g of useTabsStore.getState().groups) {
		if (g.tabIds.includes(id)) useTabsStore.getState().close(g.id, id);
	}
	closeFile(path);
}

export function closeOtherTabs(group: number, keep: string): void {
	for (const id of useTabsStore.getState().closeOthers(group, keep)) closeTab(group, id);
}

export function closeAllTabs(): void {
	for (const f of [...useEditorStore.getState().files]) closeFile(f.path);
	useTabsStore.getState().reset();
}

/** Keeps a tab's path in sync after a rename in the explorer. */
export function renameOpenPath(from: string, to: string): void {
	const tabs = useTabsStore.getState();
	for (const tab of Object.values(tabs.tabs)) {
		if (tab.path === from) tabs.rename(tab.id, { path: to, title: baseName(to) });
	}
}
