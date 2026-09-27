import type { DebugTarget } from '@shared/ipc/channels/debug';

import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { toast } from '../../stores/toast-store';
import { testAtLine } from './test-at-cursor';

/** `pkg/sub/mod.py` → `pkg.sub.mod` (a package's `__main__.py` runs as the package). */
export function moduleFor(path: string): string | null {
	const name = path
		.replace(/\.py$/, '')
		.replace(/\/__main__$/, '')
		.split('/')
		.join('.');
	return /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(name) ? name : null;
}

/** The focused editor's Python file, or null with a hint. */
function focusedPythonFile(): { path: string; lines: string[]; line: number } | null {
	const editor = focusedEditor();
	const model = editor?.getModel();
	const path = model ? toWorkspacePath(model.uri) : null;
	if (!model || !path?.endsWith('.py')) {
		toast.info('Open a Python file to debug it');
		return null;
	}
	return { path, lines: model.getLinesContent(), line: editor?.getPosition()?.lineNumber ?? 1 };
}

export function fileTarget(): DebugTarget | null {
	const file = focusedPythonFile();
	return file ? { kind: 'file', path: file.path } : null;
}

export function moduleTarget(): DebugTarget | null {
	const file = focusedPythonFile();
	if (!file) return null;
	const module = moduleFor(file.path);
	if (!module) {
		toast.info('Not an importable module', `${file.path} has a name Python can't import.`);
		return null;
	}
	return { kind: 'module', module };
}

export function testTarget(): DebugTarget | null {
	const file = focusedPythonFile();
	if (!file) return null;
	const test = testAtLine(file.lines, file.line);
	if (!test) {
		toast.info('No test at the cursor', 'Put the cursor inside a def test_… function.');
		return null;
	}
	return { kind: 'pytest', path: file.path, test };
}
