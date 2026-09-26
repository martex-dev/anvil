import type * as Monaco from 'monaco-editor';

import { useTabsStore } from '../../stores/tabs-store';

/**
 * The live Monaco editor of each editor group. Commands and AI actions act on "the editor you're
 * in", which is the focused group's, so they look it up here instead of threading refs around.
 */
const editors = new Map<number, Monaco.editor.IStandaloneCodeEditor>();

export function registerGroupEditor(
	group: number,
	editor: Monaco.editor.IStandaloneCodeEditor,
): () => void {
	editors.set(group, editor);
	return () => {
		if (editors.get(group) === editor) editors.delete(group);
	};
}

/** The focused group's editor, if it currently shows a code file. */
export function focusedEditor(): Monaco.editor.IStandaloneCodeEditor | null {
	const { focused, groups, tabs } = useTabsStore.getState();
	const group = groups.find((g) => g.id === focused);
	const tab = group?.active ? tabs[group.active] : undefined;
	if (tab?.kind !== 'code') return null;
	const editor = editors.get(focused);
	return editor?.getModel() ? editor : null;
}

export function allGroupEditors(): Monaco.editor.IStandaloneCodeEditor[] {
	return [...editors.values()];
}
