import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useRef } from 'react';

import { getCommands, runCommand } from '../../app/commands/run';
import { registerGroupEditor } from '../../lib/monaco/editors';
import { toMonacoKeybinding } from '../../lib/monaco/keybinding';
import type { MonacoApi } from '../../lib/monaco/setup';
import { useTabsStore } from '../../stores/tabs-store';
import { runCell } from '../python/run';
import { countWords, MAX_COUNTED_SELECTION, useEditorStore } from './editor-store';
import { attachBookmarks } from './extras/bookmarks';
import { attachCells } from './extras/cells';
import { attachClipboard } from './extras/clipboard';
import { attachGitLines } from './extras/git-lines';
import { attachLens } from './extras/lens';
import { attachShield } from './extras/shield';
import { attachSpotlight } from './extras/spotlight';
import { getModel, getViewState, isScratch, saveViewState } from './file-ops';
import { navHistory } from './nav-history';
import { baseName, takeQuietOpen } from './open';

interface CodeEditorProps {
	monaco: MonacoApi;
	group: number;
	/** Path of the code tab to show, or null when the group shows something else. */
	path: string | null;
	visible: boolean;
}

/** What a screen reader announces for the editor: the file, then which group it is in. */
function ariaLabelFor(path: string | null, group: number): string {
	const where = `editor group ${group + 1}`;
	if (!path) return `Editor, ${where}`;
	return `${isScratch(path) ? 'Scratchpad' : baseName(path)}, ${where}`;
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
			ariaLabel: ariaLabelFor(null, group),
			automaticLayout: true,
			fixedOverflowWidgets: true,
		});
		editorRef.current = editor;
		const unregister = registerGroupEditor(group, editor);

		const updateCursor = (): void => {
			const model = editor.getModel();
			const pos = editor.getPosition();
			const sel = editor.getSelection();
			const hasSelection = model !== null && sel !== null && !sel.isEmpty();
			// The length is cheap; the text is only copied out when it's small enough to count
			// words in, so Shift+arrowing through a huge selection stays smooth.
			const selected = hasSelection ? model.getValueLengthInRange(sel) : 0;
			const selText =
				hasSelection && selected <= MAX_COUNTED_SELECTION ? model.getValueInRange(sel) : '';
			useEditorStore
				.getState()
				.setGroupLine(
					group,
					shown.current && model && pos
						? { path: shown.current, line: pos.lineNumber }
						: null,
				);
			useEditorStore.getState().setCursor(
				model && pos
					? {
							line: pos.lineNumber,
							column: pos.column,
							language: model.getLanguageId(),
							eol: model.getEOL() === '\r\n' ? 'CRLF' : 'LF',
							selected,
							selectedWords: countWords(selText),
							selectedLines: hasSelection
								? sel.endLineNumber - sel.startLineNumber + 1
								: 0,
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
			attachLens(editor, monaco),
			attachSpotlight(editor, monaco),
			attachClipboard(editor, monaco, () =>
				isScratch(shown.current) ? 'Scratchpad' : shown.current,
			),
		];
		// Remember where you've been once the cursor settles (for Alt+← / Alt+→).
		let navTimer: ReturnType<typeof setTimeout> | undefined;
		const recordPlace = (): void => {
			clearTimeout(navTimer);
			navTimer = setTimeout(() => {
				const pos = editor.getPosition();
				if (shown.current && pos && editor.hasTextFocus())
					navHistory.visit({
						path: shown.current,
						line: pos.lineNumber,
						column: pos.column,
					});
			}, 350);
		};
		let contentTimer: ReturnType<typeof setTimeout> | undefined;
		const subs = [
			editor.onDidChangeModelContent(() => {
				clearTimeout(contentTimer);
				contentTimer = setTimeout(() => useEditorStore.getState().bumpContent(), 300);
			}),
			editor.onDidChangeCursorPosition(updateCursor),
			editor.onDidChangeCursorPosition(recordPlace),
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
			clearTimeout(navTimer);
			if (shown.current) saveViewState(shown.current, group, editor.saveViewState());
			for (const x of extras) x.dispose();
			for (const s of subs) s.dispose();
			unregister();
			useEditorStore.getState().setGroupLine(group, null);
			editor.dispose();
			editorRef.current = null;
		};
	}, [monaco, group]);

	// Show the tab's model, remembering scroll and cursor per file in this group.
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		const next = path && ready ? path : null;
		if (shown.current === next) return;
		if (shown.current) saveViewState(shown.current, group, editor.saveViewState());
		const model = next ? getModel(next) : null;
		// Set before setModel: its change events already report the cursor for this path.
		shown.current = model ? next : null;
		editor.setModel(model);
		editor.updateOptions({ ariaLabel: ariaLabelFor(shown.current, group) });
		if (model && next) {
			const view = getViewState(next, group);
			if (view) editor.restoreViewState(view);
			// Only take focus for a user-initiated open in the group you're working in: session
			// restore and previews must not pull keystrokes away from the terminal or a list.
			const quiet = takeQuietOpen(next);
			if (visible && !quiet && useTabsStore.getState().focused === group) editor.focus();
		}
	}, [path, ready, visible, group]);

	// Go-to-line requests (search results, problems, outline) for the file on screen.
	const reveal = useEditorStore((s) => s.reveal);
	useEffect(() => {
		const editor = editorRef.current;
		if (
			!editor ||
			!reveal ||
			!visible ||
			reveal.group !== group ||
			reveal.path !== path ||
			shown.current !== path
		)
			return;
		editor.setPosition({ lineNumber: reveal.line, column: reveal.column });
		editor.revealLineInCenter(reveal.line);
		if (reveal.focus) editor.focus();
		useEditorStore.getState().setReveal(null);
	}, [reveal, path, visible, ready, group]);

	return (
		<div
			ref={hostRef}
			className={visible && path ? 'absolute inset-0' : 'hidden'}
			data-editor-host
		/>
	);
}
