import { call } from '../../lib/ipc';
import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { toast } from '../../stores/toast-store';
import { useEditorStore } from '../editor/editor-store';
import { isScratch, saveFile } from '../editor/file-ops';
import {
	closeTerminal,
	runInTerminal,
	showRoleTerminal,
	useTerminalStore,
} from '../terminal/terminal-store';
import { cellAt, cellCode, cellCodeLine, findCells, needsStaging, replText } from './cells';

/**
 * A new REPL tab starts with this title; main picks IPython or plain Python when it launches the
 * session and the pane renames the tab. Checking here first cost several subprocess spawns.
 */
const REPL_TITLE = 'python';

function activePythonPath(): string | null {
	const editor = focusedEditor();
	const model = editor?.getModel();
	if (!model) return null;
	return toWorkspacePath(model.uri);
}

/** Saves and runs the focused Python file (or `python -m` it) in the Run terminal. */
export async function runPythonFile(module = false): Promise<void> {
	const path = activePythonPath() ?? useEditorStore.getState().active;
	if (isScratch(path)) {
		// The scratchpad isn't a file: run its whole buffer in the REPL instead.
		const model = focusedEditor()?.getModel();
		if (model) await sendToRepl(model.getValue());
		return;
	}
	if (!path?.endsWith('.py')) {
		toast.info('Open a Python file to run it');
		return;
	}
	const file = useEditorStore.getState().files.find((f) => f.path === path);
	if (file?.dirty && !(await saveFile(path))) return;
	const { command } = await call('python:runCommand', { path, module });
	await runInTerminal({ role: 'run', preset: 'powershell', title: 'run', command });
}

/** Where sent code came from: tracebacks then name the real file and its line numbers. */
interface CodeSource {
	/** Workspace-relative path of the file. */
	path: string;
	/** 1-based line of the file the code starts at. */
	line: number;
}

function sourceAt(
	model: { uri: { scheme: string; fsPath: string } },
	line: number,
): CodeSource | undefined {
	const path = toWorkspacePath(model.uri);
	return path && !isScratch(path) ? { path, line } : undefined;
}

/** Sends code to the Python REPL terminal, starting one (IPython if installed) if needed. */
export async function sendToRepl(code: string, source?: CodeSource): Promise<void> {
	const { text, skippedLines } = replText(code);
	if (!text) return;
	const staged = source ? { ...source, line: source.line + skippedLines } : undefined;
	// A compound statement typed raw would leave the REPL waiting at `...` for another Enter.
	const command = needsStaging(text)
		? (await call('python:stageCell', { code: text, source: staged })).command
		: text;
	await runInTerminal({ role: 'repl', preset: 'repl', title: REPL_TITLE, command });
}

/** Shows the Python REPL (starting one if needed) without typing anything into it. */
export function openRepl(): void {
	showRoleTerminal({ role: 'repl', preset: 'repl', title: REPL_TITLE });
}

/** Runs the `# %%` cell at the cursor (or the whole file if it has no cells). */
export async function runCell(advance: boolean, line?: number): Promise<void> {
	const editor = focusedEditor();
	const model = editor?.getModel();
	if (!editor || !model) return;
	if (model.getLanguageId() !== 'python') {
		toast.info('Cells run Python files');
		return;
	}
	const lines = model.getLinesContent();
	const cells = findCells(lines);
	const at = line ?? editor.getPosition()?.lineNumber ?? 1;
	const cell = cellAt(cells, at);
	const code = cell ? cellCode(lines, cell) : model.getValue();
	await sendToRepl(code, sourceAt(model, cell ? cellCodeLine(lines, cell) : 1));
	if (advance && cell) {
		const next = cells.find((c) => c.start > cell.end);
		const target = next ? Math.min(next.start + 1, model.getLineCount()) : cell.end;
		editor.setPosition({ lineNumber: target, column: 1 });
		editor.revealLineInCenterIfOutsideViewport(target);
	}
}

/** Runs the selection, or the current line when nothing is selected (then moves down). */
export async function runSelection(): Promise<void> {
	const editor = focusedEditor();
	const model = editor?.getModel();
	const selection = editor?.getSelection();
	if (!editor || !model || !selection) return;
	if (selection.isEmpty()) {
		const line = selection.startLineNumber;
		await sendToRepl(model.getLineContent(line));
		const next = Math.min(line + 1, model.getLineCount());
		editor.setPosition({ lineNumber: next, column: 1 });
		return;
	}
	await sendToRepl(model.getValueInRange(selection), sourceAt(model, selection.startLineNumber));
}

/** Kills the REPL (and its namespace) and starts a clean one. */
export async function restartRepl(): Promise<void> {
	const repl = useTerminalStore.getState().tabs.find((t) => t.role === 'repl');
	if (repl) closeTerminal(repl.id);
	await sendToRepl('print("REPL ready")');
}
