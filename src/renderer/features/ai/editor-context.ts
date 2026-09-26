import type * as Monaco from 'monaco-editor';

import type { AiContext } from '@shared/ipc/channels/ai';

import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';

export interface ActiveEditor {
	path: string;
	language: string;
	editor: Monaco.editor.IStandaloneCodeEditor;
	model: Monaco.editor.ITextModel;
	/** 1-based inclusive lines, or null when nothing is selected. */
	selection: { startLine: number; endLine: number; text: string } | null;
}

/** The code editor you're working in (focused group) and its selection. */
export function activeEditor(): ActiveEditor | null {
	const editor = focusedEditor();
	const model = editor?.getModel();
	if (!editor || !model) return null;
	const path = toWorkspacePath(model.uri);
	if (!path) return null;
	const sel = editor.getSelection();
	const selection =
		sel && !sel.isEmpty()
			? {
					startLine: sel.startLineNumber,
					// A selection ending at column 1 doesn't really include that line.
					endLine:
						sel.endColumn === 1 && sel.endLineNumber > sel.startLineNumber
							? sel.endLineNumber - 1
							: sel.endLineNumber,
					text: model.getValueInRange(sel),
				}
			: null;
	return { path, language: model.getLanguageId(), editor, model, selection };
}

const MAX_FILE = 200_000;

export function fileContext(editor: Pick<ActiveEditor, 'path' | 'language' | 'model'>): AiContext {
	const text = editor.model.getValue();
	return {
		kind: 'file',
		label: editor.path,
		language: editor.language,
		text: text.length > MAX_FILE ? `${text.slice(0, MAX_FILE)}\n… (truncated)` : text,
	};
}

export function selectionContext(editor: ActiveEditor): AiContext | null {
	if (!editor.selection) return null;
	return {
		kind: 'selection',
		label: `${editor.path}:${editor.selection.startLine}-${editor.selection.endLine}`,
		language: editor.language,
		text: editor.selection.text,
	};
}

/** Problems on (or near) the given lines, as context for "fix this". */
export function problemsContext(
	monaco: {
		editor: { getModelMarkers(filter: { resource: Monaco.Uri }): Monaco.editor.IMarker[] };
	},
	editor: ActiveEditor,
	lines?: { start: number; end: number },
): AiContext | null {
	const markers = monaco.editor
		.getModelMarkers({ resource: editor.model.uri })
		.filter(
			(m) =>
				!lines ||
				(m.startLineNumber >= lines.start - 2 && m.startLineNumber <= lines.end + 2),
		);
	if (markers.length === 0) return null;
	return {
		kind: 'problems',
		label: `${editor.path} problems`,
		language: null,
		text: markers
			.map(
				(m) =>
					`${editor.path}:${m.startLineNumber}:${m.startColumn} [${m.source ?? m.owner}] ${m.message}`,
			)
			.join('\n'),
	};
}
