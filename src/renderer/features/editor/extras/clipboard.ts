import type * as Monaco from 'monaco-editor';
import { create } from 'zustand';

import type { MonacoApi } from '../../../lib/monaco/setup';

export interface ClipEntry {
	text: string;
	at: number;
	/** File it was copied from, if known. */
	source: string | null;
}

const MAX = 30;
const MAX_CHARS = 200_000;

interface ClipState {
	items: ClipEntry[];
	push: (text: string, source: string | null) => void;
	clear: () => void;
}

/** Recent copies (kept in memory only: clipboards are full of things that shouldn't hit disk). */
export const useClipboardHistory = create<ClipState>((set) => ({
	items: [],
	push: (text, source) =>
		set((s) => {
			if (!text.trim() || text.length > MAX_CHARS) return s;
			const rest = s.items.filter((i) => i.text !== text);
			return { items: [{ text, at: Date.now(), source }, ...rest].slice(0, MAX) };
		}),
	clear: () => set({ items: [] }),
}));

let started = false;

/** Copies anywhere outside the editor (chat, terminal selection, viewers). */
export function startClipboardTracking(): void {
	if (started) return;
	started = true;
	const onCopy = (): void => {
		const text = document.getSelection()?.toString() ?? '';
		if (text) useClipboardHistory.getState().push(text, null);
	};
	document.addEventListener('copy', onCopy);
	document.addEventListener('cut', onCopy);
}

/** Monaco copies via its hidden textarea, so record what Ctrl+C / Ctrl+X take from the model. */
export function attachClipboard(
	editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
	path: () => string | null,
): Monaco.IDisposable {
	return editor.onKeyDown((e) => {
		if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
		if (e.keyCode !== monaco.KeyCode.KeyC && e.keyCode !== monaco.KeyCode.KeyX) return;
		const model = editor.getModel();
		if (!model) return;
		const parts = (editor.getSelections() ?? []).map((sel) =>
			// An empty selection copies the whole line, like VS Code.
			sel.isEmpty()
				? `${model.getLineContent(sel.startLineNumber)}\n`
				: model.getValueInRange(sel),
		);
		useClipboardHistory.getState().push(parts.join('\n'), path());
	});
}
