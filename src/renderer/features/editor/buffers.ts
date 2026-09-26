import type * as Monaco from 'monaco-editor';

import { minimalEdits } from '../../lib/minimal-edits';
import { codeTabId, useTabsStore } from '../../stores/tabs-store';
import { useEditorStore } from './editor-store';

/** A text buffer the editor holds for an open file (or the scratchpad). */
export interface Tracked {
	model: Monaco.editor.ITextModel;
	/** Alternative version id at last load/save; differs from the current one when dirty. */
	savedVersion: number;
	listener: Monaco.IDisposable;
	/**
	 * Scroll, cursor and folds per editor group: the same file shown in both groups keeps an
	 * independent position in each.
	 */
	viewStates: Map<number, Monaco.editor.ICodeEditorViewState>;
}

/** Open buffers by workspace-relative path. */
export const tracked = new Map<string, Tracked>();

export function getModel(path: string): Monaco.editor.ITextModel | null {
	return tracked.get(path)?.model ?? null;
}

export function saveViewState(
	path: string,
	group: number,
	state: Monaco.editor.ICodeEditorViewState | null,
): void {
	const t = tracked.get(path);
	if (!t) return;
	if (state) t.viewStates.set(group, state);
	else t.viewStates.delete(group);
}

export function getViewState(
	path: string,
	group: number,
): Monaco.editor.ICodeEditorViewState | null {
	return tracked.get(path)?.viewStates.get(group) ?? null;
}

export function markDirty(path: string): void {
	const t = tracked.get(path);
	if (!t) return;
	const dirty = t.model.getAlternativeVersionId() !== t.savedVersion;
	useEditorStore.getState().update(path, { dirty });
	// Edited previews become real tabs, so the next preview can't replace unsaved work.
	if (dirty) useTabsStore.getState().pin(codeTabId(path));
}

/**
 * Turns the buffer into `text` as one undoable edit that touches only the changed lines, so
 * cursors, scroll and folds elsewhere stay put (a whole-buffer replace resets them all).
 */
export function replaceText(model: Monaco.editor.ITextModel, text: string): void {
	const edits = minimalEdits(model.getLinesContent(), text, model.getEOL()) ?? [
		{ range: model.getFullModelRange(), text },
	];
	if (edits.length > 0) model.pushEditOperations([], edits, () => null);
}
