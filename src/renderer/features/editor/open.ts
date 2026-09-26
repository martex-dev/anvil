import { getSettings } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { focusedEditor } from '../../lib/monaco/editors';
import { loadMonaco } from '../../lib/monaco/load';
import type { MonacoApi } from '../../lib/monaco/setup';
import { codeTabId, type Tab, type TabKind, useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import type { OpenFileRequest } from '../../stores/workbench-store';
import { useEditorStore } from './editor-store';
import { closeFile, isScratch, openFile, openScratch, SCRATCH_PATH } from './file-ops';

const DATA = /\.(csv|tsv|tab|parquet|feather|arrow|ipc|jsonl|ndjson|xlsx)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;
const NOTEBOOK = /\.ipynb$/i;

export function kindForPath(path: string): TabKind {
	if (NOTEBOOK.test(path)) return 'notebook';
	if (IMAGE.test(path)) return 'image';
	if (DATA.test(path)) return 'data';
	return 'code';
}

/** Files the data grid can read, including ones normally opened as text (plain JSON). */
export function canOpenAsTable(path: string): boolean {
	return DATA.test(path) || /\.json$/i.test(path);
}

/** Whether an open belongs in Quick Open's recents: explicit opens of real files only. */
export function remembersRecent(request: OpenFileRequest): boolean {
	return request.remember !== false && !isScratch(request.path);
}

export const baseName = (path: string): string => path.split('/').at(-1) ?? path;

export function tabFor(path: string, kind: TabKind, preview = false): Tab {
	const title = kind === 'markdown' ? `Preview ${baseName(path)}` : baseName(path);
	const id = kind === 'code' ? codeTabId(path) : `${kind}:${path}`;
	return { id, kind, path, title, preview };
}

export const editorPrefs = (): Parameters<typeof loadMonaco>[0] => getSettings();

/** Opens a file in the right viewer: text in Monaco, tables in the grid, images, notebooks. */
/** Opens (or focuses) the scratchpad tab. */
export async function openScratchTab(): Promise<void> {
	try {
		const monaco = await loadMonaco(editorPrefs());
		openScratch(monaco);
		useTabsStore.getState().open({
			id: codeTabId(SCRATCH_PATH),
			kind: 'code',
			path: SCRATCH_PATH,
			title: 'Scratchpad',
		});
	} catch (error) {
		toast.error(
			'The editor failed to load',
			error instanceof Error ? error.message : undefined,
		);
	}
}

/** Code tabs opened while Monaco failed to load: path → workspace root. */
const unloaded = new Map<string, string>();

/**
 * Code files opened without taking focus (session restore, previews). The group's editor reads
 * the mark once, when it swaps the file's model in.
 */
const quietOpens = new Set<string>();

/** True (once) if `path` was opened without focus; clears the mark. */
export function takeQuietOpen(path: string): boolean {
	return quietOpens.delete(path);
}

export async function openPath(root: string, request: OpenFileRequest): Promise<void> {
	if (isScratch(request.path)) return openScratchTab();
	const kind: TabKind = request.as ?? kindForPath(request.path);
	const tabs = useTabsStore.getState();
	let group: number | undefined;
	if (request.side) {
		const other = tabs.groups.find((g) => g.id !== tabs.focused);
		if (!other) {
			// A new group of its own: the focused group keeps what it shows (the Markdown source
			// stays next to its preview).
			tabs.openInNewGroup(tabFor(request.path, kind));
			group = useTabsStore.getState().focused;
		} else group = other.id;
	}
	const tab = tabFor(request.path, kind, request.preview ?? false);
	if (kind !== 'code') {
		tabs.open(tab, group === undefined ? {} : { group });
		return;
	}
	const focus = request.focus ?? !request.preview;
	// The group the tab lands in; its editor (and only its) handles the reveal.
	const targetId = group ?? tabs.focused;
	const target = useTabsStore.getState().groups.find((g) => g.id === targetId);
	const shown =
		target?.active === tab.id &&
		useEditorStore.getState().files.some((f) => f.path === request.path && f.state === 'ready');
	// A file already on screen isn't swapped in again, so a mark for it would linger.
	if (focus || shown) quietOpens.delete(request.path);
	else quietOpens.add(request.path);
	useEditorStore.getState().setReveal(
		request.line
			? {
					path: request.path,
					line: request.line,
					column: request.column ?? 1,
					group: targetId,
					focus,
				}
			: null,
	);
	tabs.open(tab, group === undefined ? {} : { group });
	let monaco: MonacoApi;
	try {
		monaco = await loadMonaco(editorPrefs());
	} catch (error) {
		// The tab stays open behind the editor's error state; Retry picks the file up again.
		unloaded.set(request.path, root);
		rlog.error('editor', 'editor failed to load', error);
		toast.error(
			'The editor failed to load',
			error instanceof Error ? error.message : undefined,
		);
		return;
	}
	unloaded.delete(request.path);
	// The tab was closed while Monaco loaded (e.g. the folder changed): nothing to read into.
	if (!useTabsStore.getState().tabs[tab.id]) return;
	await openFile(monaco, root, request.path);
}

/**
 * Loads the files whose tabs opened while Monaco failed to boot, once it's up (after Retry).
 * Without this their tabs would wait for a buffer that nothing is loading.
 */
export async function openUnloadedFiles(monaco: MonacoApi): Promise<void> {
	const waiting = [...unloaded];
	unloaded.clear();
	const { tabs } = useTabsStore.getState();
	await Promise.all(
		waiting.map(async ([path, root]) => {
			const hasTab = Object.values(tabs).some((t) => t.kind === 'code' && t.path === path);
			const loaded = useEditorStore.getState().files.some((f) => f.path === path);
			if (hasTab && !loaded) await openFile(monaco, root, path);
		}),
	);
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

/**
 * Puts keyboard focus back into the focused group after one of its tabs closed (the element
 * that had focus, e.g. the tab's close button, is gone): its editor, else its active tab.
 * Deferred so React has swapped the next file in first. With `onlyIfLost`, focus that is still
 * somewhere real (the user moved on) is left alone.
 */
export function refocusGroup(onlyIfLost = false): void {
	setTimeout(() => {
		const current = document.activeElement;
		if (onlyIfLost && current && current !== document.body) return;
		const editor = focusedEditor();
		if (editor) {
			editor.focus();
			return;
		}
		const { focused } = useTabsStore.getState();
		document
			.querySelector<HTMLElement>(
				`[role='tablist'][data-group='${focused}'] [role='tab'][aria-selected='true']`,
			)
			?.focus();
	}, 0);
}

export function closeOtherTabs(group: number, keep: string): void {
	for (const id of useTabsStore.getState().closeOthers(group, keep)) closeTab(group, id);
}

export function closeAllTabs(): void {
	quietOpens.clear();
	unloaded.clear();
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
