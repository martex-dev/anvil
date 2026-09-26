import { call } from '../../lib/ipc';
import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { toast } from '../../stores/toast-store';
import { useEditorStore } from '../editor/editor-store';
import { saveFile } from '../editor/file-ops';
import { closeTerminal, runInTerminal, useTerminalStore } from '../terminal/terminal-store';
import { cellAt, cellCode, dedent, findCells } from './cells';

/** Whether the REPL runs IPython (checked once per session; `%run -i` needs it). */
let ipython: Promise<boolean> | null = null;
export function resetPythonTools(): void {
	ipython = null;
}
function hasIPython(): Promise<boolean> {
	ipython ??= call('python:tools')
		.then((t) => t.ipython)
		.catch(() => false);
	return ipython;
}

function activePythonPath(): string | null {
	const editor = focusedEditor();
	const model = editor?.getModel();
	if (!model) return null;
	return toWorkspacePath(model.uri);
}

/** Saves and runs the focused Python file (or `python -m` it) in the Run terminal. */
export async function runPythonFile(module = false): Promise<void> {
	const path = activePythonPath() ?? useEditorStore.getState().active;
	if (!path?.endsWith('.py')) {
		toast.info('Open a Python file to run it');
		return;
	}
	const file = useEditorStore.getState().files.find((f) => f.path === path);
	if (file?.dirty && !(await saveFile(path))) return;
	const { command } = await call('python:runCommand', { path, module });
	await runInTerminal({ role: 'run', preset: 'powershell', title: 'run', command });
}

/** Sends code to the Python REPL terminal, starting one (IPython if installed) if needed. */
export async function sendToRepl(code: string): Promise<void> {
	const text = dedent(code).trim();
	if (!text) return;
	const multiline = text.includes('\n');
	const ip = await hasIPython();
	const command = multiline ? (await call('python:stageCell', { code: text })).command : text;
	await runInTerminal({ role: 'repl', preset: 'repl', title: ip ? 'ipython' : 'repl', command });
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
	await sendToRepl(code);
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
	await sendToRepl(model.getValueInRange(selection));
}

/** Kills the REPL (and its namespace) and starts a clean one. */
export async function restartRepl(): Promise<void> {
	const repl = useTerminalStore.getState().tabs.find((t) => t.role === 'repl');
	if (repl) closeTerminal(repl.id);
	resetPythonTools();
	await sendToRepl('print("REPL ready")');
}
