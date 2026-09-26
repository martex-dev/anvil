import {
	Braces,
	ListChecks,
	Play,
	PlayCircle,
	RotateCcw,
	SquareTerminal,
	TextCursorInput,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { toast } from '../../stores/toast-store';
import { formatPython } from '../editor/file-ops';
import { runInTerminal } from '../terminal/terminal-store';
import { restartRepl, runCell, runPythonFile, runSelection, sendToRepl } from './run';
import { pickPythonEnv } from './use-python';

export const PYTHON_COMMANDS: Command[] = [
	{
		id: 'python.runFile',
		title: 'Run Python File',
		category: 'Python',
		shortcut: 'F5',
		icon: Play,
		run: () => runPythonFile(false),
	},
	{
		id: 'python.runModule',
		title: 'Run File as Module (python -m)',
		category: 'Python',
		icon: PlayCircle,
		run: () => runPythonFile(true),
	},
	{
		id: 'python.runCell',
		title: 'Run Cell in REPL',
		category: 'Python',
		shortcut: 'Ctrl+Enter',
		scope: 'editor',
		editorLanguage: 'python',
		keywords: ['# %%', 'jupyter', 'ipython', 'notebook'],
		icon: ListChecks,
		run: () => runCell(false),
	},
	{
		id: 'python.runCellAdvance',
		title: 'Run Cell and Advance',
		category: 'Python',
		shortcut: 'Shift+Enter',
		scope: 'editor',
		editorLanguage: 'python',
		icon: ListChecks,
		run: () => runCell(true),
	},
	{
		id: 'python.runSelection',
		title: 'Run Selection / Line in REPL',
		category: 'Python',
		shortcut: 'F9',
		icon: TextCursorInput,
		run: runSelection,
	},
	{
		id: 'python.openRepl',
		title: 'Open Python REPL',
		category: 'Python',
		keywords: ['ipython', 'console', 'interactive'],
		icon: SquareTerminal,
		run: () => sendToRepl('import sys; print(sys.version)'),
	},
	{
		id: 'python.restartRepl',
		title: 'Restart Python REPL',
		category: 'Python',
		icon: RotateCcw,
		run: restartRepl,
	},
	{
		id: 'python.selectEnv',
		title: 'Select Python Interpreter…',
		category: 'Python',
		keywords: ['venv', 'conda', 'uv', 'environment'],
		run: pickPythonEnv,
	},
	{
		id: 'python.format',
		title: 'Format Python File with Ruff',
		category: 'Python',
		shortcut: 'Ctrl+Alt+F',
		scope: 'editor',
		editorLanguage: 'python',
		icon: Braces,
		run: async () => {
			const model = focusedEditor()?.getModel();
			const path = model ? toWorkspacePath(model.uri) : null;
			if (!model || !path?.endsWith('.py')) {
				toast.info('Open a Python file to format it');
				return;
			}
			if (await formatPython(path, model)) toast.success('Formatted with ruff');
		},
	},
	{
		id: 'python.pytest',
		title: 'Run Tests (pytest)',
		category: 'Python',
		icon: ListChecks,
		run: () =>
			runInTerminal({
				role: 'task:pytest',
				preset: 'python',
				title: 'pytest',
				command: 'python -m pytest -q',
			}),
	},
	{
		id: 'python.pytestFile',
		title: 'Run Tests in Current File',
		category: 'Python',
		run: () => {
			const model = focusedEditor()?.getModel();
			const path = model ? toWorkspacePath(model.uri) : null;
			if (!path) return;
			return runInTerminal({
				role: 'task:pytest',
				preset: 'python',
				title: 'pytest',
				command: `python -m pytest -q "${path}"`,
			});
		},
	},
];
