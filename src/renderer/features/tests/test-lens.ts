import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../lib/monaco/setup';
import { runTestAtCursor } from './editor-actions';
import { currentRoot, debugTests, ensureDiscovered, runTests, useTestsStore } from './tests-store';
import { fileNode, lineTargets, type NodeStatus, statusOf } from './tree-utils';

import './tests.css';

const RUN = 'anvil.tests.runNode';
const DEBUG = 'anvil.tests.debugNode';

/** Codicons in the lens title; tests.css colours them by result. */
const ICON: Record<NodeStatus, string> = {
	none: '$(play)',
	queued: '$(history)',
	running: '$(loading~spin)',
	passed: '$(pass-filled)',
	failed: '$(error)',
	skipped: '$(circle-slash)',
};

const LABEL: Record<NodeStatus, string> = {
	none: '',
	queued: ' (queued)',
	running: ' (running)',
	passed: ' (passed)',
	failed: ' (failed)',
	skipped: ' (skipped)',
};

/** pytest's default file names; opening one discovers the folder's tests on first use. */
const TEST_FILE = /(^|[\\/])(test_[^\\/]*|[^\\/]*_test)\.py$/i;

let users = 0;
let registration: Monaco.IDisposable | null = null;

/**
 * "▶ Run test | Debug" above every collected test function and class, marked with the last
 * result. A code lens rather than a glyph: the glyph margin already holds cell arrows,
 * bookmarks and breakpoints, and a click there must stay theirs.
 */
function register(monaco: MonacoApi): Monaco.IDisposable {
	const changed = new monaco.Emitter<Monaco.languages.CodeLensProvider>();
	let timer: ReturnType<typeof setTimeout> | null = null;
	// Results stream in quickly during a run; repaint the lenses at most a few times a second.
	const unsubscribe = useTestsStore.subscribe((s, prev) => {
		if (s.discovery === prev.discovery && s.run === prev.run) return;
		timer ??= setTimeout(() => {
			timer = null;
			changed.fire(provider);
		}, 150);
	});
	const provider: Monaco.languages.CodeLensProvider = {
		onDidChange: changed.event,
		provideCodeLenses: (model) => {
			const s = useTestsStore.getState();
			if (s.root !== currentRoot() || s.discovery?.status !== 'ok') {
				if (TEST_FILE.test(model.uri.fsPath)) ensureDiscovered();
				return { lenses: [], dispose: () => undefined };
			}
			const file = fileNode(s.discovery.tree, model.uri.fsPath);
			const lenses: Monaco.languages.CodeLens[] = [];
			for (const node of file ? lineTargets(file) : []) {
				if (node.line === null || node.line > model.getLineCount()) continue;
				const status = statusOf(node, s.run);
				const range = new monaco.Range(node.line, 1, node.line, 1);
				const what = node.kind === 'class' ? 'Run tests' : 'Run test';
				lenses.push(
					{
						range,
						command: {
							id: RUN,
							title: `${ICON[status]} ${what}${LABEL[status]}`,
							tooltip: `Run ${node.id}`,
							arguments: [node.id],
						},
					},
					{
						range,
						command: {
							id: DEBUG,
							title: 'Debug (pdb)',
							tooltip: `Run ${node.id} under pdb in a terminal`,
							arguments: [node.id],
						},
					},
				);
			}
			return { lenses, dispose: () => undefined };
		},
	};
	const subs = [
		monaco.editor.registerCommand(RUN, (_accessor, id: unknown) => {
			if (typeof id === 'string') void runTests({ ids: [id], files: [] });
			else void runTestAtCursor(false);
		}),
		monaco.editor.registerCommand(DEBUG, (_accessor, id: unknown) => {
			if (typeof id === 'string') void debugTests([id]);
		}),
		monaco.languages.registerCodeLensProvider('python', provider),
	];
	return {
		dispose() {
			if (timer) clearTimeout(timer);
			unsubscribe();
			for (const s of subs) s.dispose();
			changed.dispose();
		},
	};
}

/**
 * Attaches the test lenses for one editor. The provider is global per language, so the first
 * editor registers it and the last one to go removes it.
 */
export function attachTestLens(
	_editor: Monaco.editor.IStandaloneCodeEditor,
	monaco: MonacoApi,
): Monaco.IDisposable {
	users++;
	registration ??= register(monaco);
	let disposed = false;
	return {
		dispose() {
			if (disposed) return;
			disposed = true;
			users--;
			if (users === 0) {
				registration?.dispose();
				registration = null;
			}
		},
	};
}
