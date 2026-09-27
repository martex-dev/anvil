import type { TestNode } from '@shared/ipc/channels/tests';

import { focusedEditor } from '../../lib/monaco/editors';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { testAtCursor } from './cursor';
import { currentRoot, debugTests, discoverTests, runTests, useTestsStore } from './tests-store';
import { fileNode } from './tree-utils';

/** Shows the Tests view, where a run started from the palette reports. */
export function revealTests(): void {
	useLayoutStore.getState().showView('tests');
}

/** The discovered tree for the open folder, discovering first when there is none yet. */
async function currentTree(): Promise<readonly TestNode[]> {
	const fresh = (): readonly TestNode[] | null => {
		const s = useTestsStore.getState();
		return s.root === currentRoot() && s.discovery?.status === 'ok' ? s.discovery.tree : null;
	};
	const known = fresh();
	if (known) return known;
	await discoverTests();
	return fresh() ?? [];
}

function pythonEditor(): {
	path: string;
	file: string;
	lines: string[];
	line: number;
} | null {
	const editor = focusedEditor();
	const model = editor?.getModel();
	const path = model ? toWorkspacePath(model.uri) : null;
	if (!editor || !model || !path?.endsWith('.py')) return null;
	return {
		path,
		file: model.uri.fsPath,
		lines: model.getLinesContent(),
		line: editor.getPosition()?.lineNumber ?? 1,
	};
}

/** Runs every test in the focused file (a file pytest hasn't been asked about yet runs too). */
export async function runCurrentFileTests(): Promise<void> {
	const at = pythonEditor();
	if (!at) {
		toast.info('Open a Python test file', 'Then run this command to test just that file.');
		return;
	}
	const file = fileNode(await currentTree(), at.file);
	revealTests();
	await runTests(file ? { ids: [file.id], files: [] } : { ids: [], files: [at.path] });
}

/** Runs (or debugs under pdb) the test function or class the cursor is in. */
export async function runTestAtCursor(debug = false): Promise<void> {
	const at = pythonEditor();
	if (!at) {
		toast.info('Open a Python test file', 'Put the cursor inside a test to run it.');
		return;
	}
	const file = fileNode(await currentTree(), at.file);
	const node = file ? testAtCursor(file, at.lines, at.line) : null;
	if (!node) {
		toast.info(
			'No test at the cursor',
			'Put the cursor inside a test_ function or a Test class that pytest collects.',
		);
		return;
	}
	if (debug) await debugTests([node.id]);
	else await runTests({ ids: [node.id], files: [] });
}
