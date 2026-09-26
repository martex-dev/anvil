import { groupEditors } from '../../lib/monaco/editors';
import { getLoadedMonaco } from '../../lib/monaco/load';
import type { MonacoApi } from '../../lib/monaco/setup';
import { useTabsStore } from '../../stores/tabs-store';
import { languageOverride, markDirty, toUri, tracked } from './buffers';
import { useEditorStore } from './editor-store';
import { navHistory } from './nav-history';
import { tabFor } from './open';

/** Where `path` ends up when `from` (a file, or a folder with everything in it) becomes `to`. */
export function movedPath(path: string, from: string, to: string): string | null {
	if (path === from) return to;
	return path.startsWith(`${from}/`) ? `${to}${path.slice(from.length)}` : null;
}

/**
 * Moves a buffer to a model at the new path's URI (language servers and the save path key off
 * it), carrying its text, unsaved state and per-group view state over.
 */
function moveBuffer(monaco: MonacoApi, root: string, from: string, to: string): void {
	const t = tracked.get(from);
	if (!t) return;
	const views = new Map(t.viewStates);
	// Editors showing the file hold its latest cursor and scroll; they lose the model below.
	for (const [group, editor] of groupEditors()) {
		const view = editor.getModel() === t.model ? editor.saveViewState() : null;
		if (view) views.set(group, view);
	}
	const text = t.model.getValue();
	const dirty = t.model.getAlternativeVersionId() !== t.savedVersion;
	const uri = toUri(monaco, root, to);
	const existing = monaco.editor.getModel(uri);
	if (existing && existing.getValue() !== text) existing.setValue(text);
	const model = existing ?? monaco.editor.createModel(text, languageOverride(to), uri);
	model.setEOL(
		t.model.getEOL() === '\r\n'
			? monaco.editor.EndOfLineSequence.CRLF
			: monaco.editor.EndOfLineSequence.LF,
	);
	t.listener.dispose();
	t.model.dispose();
	tracked.delete(from);
	tracked.set(to, {
		model,
		// Unsaved edits stay unsaved: the disk still has the version saved under the old name.
		savedVersion: dirty ? -1 : model.getAlternativeVersionId(),
		listener: model.onDidChangeContent(() => markDirty(to)),
		viewStates: views,
	});
}

/**
 * Keeps open files in step with a rename in the explorer: tabs, buffers and the editor store
 * all move to the new path, so edits keep saving to the renamed file instead of recreating the
 * old one.
 */
export function renameOpenPath(root: string, from: string, to: string): void {
	navHistory.forget(from);
	const monaco = getLoadedMonaco();
	if (monaco) {
		for (const path of [...tracked.keys()]) {
			const next = movedPath(path, from, to);
			if (next) moveBuffer(monaco, root, path, next);
		}
	}
	const editor = useEditorStore.getState();
	for (const file of editor.files) {
		const next = movedPath(file.path, from, to);
		if (next) editor.rename(file.path, next);
	}
	const tabs = useTabsStore.getState();
	for (const tab of Object.values(tabs.tabs)) {
		const next = tab.path ? movedPath(tab.path, from, to) : null;
		if (!next) continue;
		const moved = tabFor(next, tab.kind, tab.preview ?? false);
		tabs.replace(tab.id, { ...tab, id: moved.id, path: next, title: moved.title });
	}
}
