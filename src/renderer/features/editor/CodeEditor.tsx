import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useRef } from 'react';

import { getCommands, runCommand } from '../../app/commands/run';
import { registerGroupEditor } from '../../lib/monaco/editors';
import { toMonacoKeybinding } from '../../lib/monaco/keybinding';
import type { MonacoApi } from '../../lib/monaco/setup';
import { useTabsStore } from '../../stores/tabs-store';
import { runCell } from '../python/run';
import { useEditorStore } from './editor-store';
import { attachBookmarks } from './extras/bookmarks';
import { attachCells } from './extras/cells';
import { attachGitLines } from './extras/git-lines';
import { attachShield } from './extras/shield';
import { getModel, getViewState, saveViewState } from './file-ops';

interface CodeEditorProps {
	monaco: MonacoApi;
	group: number;
	/** Path of the code tab to show, or null when the group shows something else. */
	path: string | null;
	visible: boolean;
}

/**
 * One Monaco instance per editor group; switching tabs swaps models into it (cheap, and
 * undo history lives in the model). Editor-scoped commands become Monaco actions here.
 */
export function CodeEditor({ monaco, group, path, visible }: CodeEditorProps): JSX.Element {
	const hostRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
	const shown = useRef<string | null>(null);
	const ready = useEditorStore((s) =>
		path ? s.files.find((f) => f.path === path)?.state === 'ready' : false,
	);

	useEffect(() => {
		if (!hostRef.current) return;
		const editor = monaco.editor.create(hostRef.current, {
			model: null,
			automaticLayout: true,
			fixedOverflowWidgets: true,
		});
		editorRef.current = editor;
		const unregister = registerGroupEditor(group, editor);

		const updateCursor = (): void => {
			const model = editor.getModel();
			const pos = editor.getPosition();
			const sel = editor.getSelection();
			useEditorStore.getState().setCursor(
				model && pos
					? {
							line: pos.lineNumber,
							column: pos.column,
							language: model.getLanguageId(),
							eol: model.getEOL() === '\r\n' ? 'CRLF' : 'LF',
							selected: sel && !sel.isEmpty() ? model.getValueInRange(sel).length : 0,
							lines: model.getLineCount(),
							tabSize: model.getOptions().tabSize,
							insertSpaces: model.getOptions().insertSpaces,
						}
					: null,
			);
		};
		const extras = [
			attachCells(editor, monaco, (line) => void runCell(false, line)),
			attachShield(editor, monaco),
			attachGitLines(editor, monaco),
			attachBookmarks(editor, monaco),
		];
		let contentTimer: ReturnType<typeof setTimeout> | undefined;
		const subs = [
			editor.onDidChangeModelContent(() => {
				clearTimeout(contentTimer);
				contentTimer = setTimeout(() => useEditorStore.getState().bumpContent(), 300);
			}),
			editor.onDidChangeCursorPosition(updateCursor),
			editor.onDidChangeCursorSelection(updateCursor),
			editor.onDidChangeModel(updateCursor),
			editor.onDidChangeModelLanguage(updateCursor),
			editor.onDidFocusEditorText(() => {
				useTabsStore.getState().focus(group);
				updateCursor();
			}),
		];
		// Palette commands scoped to the editor are real Monaco actions: their keys only fire
		// while the editor has focus, and they show in Monaco's own context menu.
		for (const command of getCommands()) {
			if (command.scope !== 'editor') continue;
			const binding = command.shortcut ? toMonacoKeybinding(monaco, command.shortcut) : null;
			subs.push(
				editor.addAction({
					id: `anvil.${command.id}`,
					label: `${command.category}: ${command.title}`,
					keybindings: binding === null ? [] : [binding],
					...(command.editorLanguage
						? { precondition: `editorLangId == ${command.editorLanguage}` }
						: {}),
					...(command.category === 'AI' || command.category === 'Python'
						? {
								contextMenuGroupId: command.category === 'AI' ? '0_ai' : '1_python',
								contextMenuOrder: 1,
							}
						: {}),
					run: () => void runCommand(command),
				}),
			);
		}
		return () => {
			clearTimeout(contentTimer);
			if (shown.current) saveViewState(shown.current, editor.saveViewState());
			for (const x of extras) x.dispose();
			for (const s of subs) s.dispose();
			unregister();
			editor.dispose();
			editorRef.current = null;
		};
	}, [monaco, group]);

	// Show the tab's model, remembering scroll and cursor per file.
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		const next = path && ready ? path : null;
		if (shown.current === next) return;
		if (shown.current) saveViewState(shown.current, editor.saveViewState());
		const model = next ? getModel(next) : null;
		editor.setModel(model);
		shown.current = model ? next : null;
		if (model && next) {
			const view = getViewState(next);
			if (view) editor.restoreViewState(view);
			if (visible) editor.focus();
		}
	}, [path, ready, visible]);

	// Go-to-line requests (search results, problems, outline) for the file on screen.
	const reveal = useEditorStore((s) => s.reveal);
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || !reveal || !visible || reveal.path !== path || shown.current !== path)
			return;
		editor.setPosition({ lineNumber: reveal.line, column: reveal.column });
		editor.revealLineInCenter(reveal.line);
		editor.focus();
		useEditorStore.getState().setReveal(null);
	}, [reveal, path, visible, ready]);

	return (
		<div
			ref={hostRef}
			className={visible && path ? 'absolute inset-0' : 'hidden'}
			data-editor-host
		/>
	);
}
