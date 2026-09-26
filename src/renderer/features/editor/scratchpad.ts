import type * as Monaco from 'monaco-editor';

import { rlog } from '../../lib/log';
import type { MonacoApi } from '../../lib/monaco/setup';
import { tracked } from './buffers';
import { useEditorStore } from './editor-store';

/** The scratchpad's buffer id: a code tab that lives in local storage, not on disk. */
export const SCRATCH_PATH = '__scratch__';
const SCRATCH_KEY = 'anvil.scratchpad';
const SCRATCH_DEFAULT = [
	'# %% Scratchpad: persists between sessions, never touches your project.',
	'# Ctrl+Enter runs a cell in the REPL · Change language from the palette.',
	'',
	'import math',
	'',
	'# %%',
	'print(math.tau)',
	'',
].join('\n');

export function isScratch(path: string | null | undefined): boolean {
	return path === SCRATCH_PATH;
}

interface ScratchState {
	text: string;
	language: string;
}

function readScratch(): ScratchState | null {
	try {
		return JSON.parse(localStorage.getItem(SCRATCH_KEY) ?? 'null') as ScratchState | null;
	} catch {
		// Storage blocked or a corrupt value: start from the default text.
		return null;
	}
}

export function openScratch(monaco: MonacoApi): void {
	const store = useEditorStore.getState();
	if (store.files.some((f) => f.path === SCRATCH_PATH)) return;
	const saved = readScratch();
	const uri = monaco.Uri.parse('inmemory://anvil/scratchpad');
	const model =
		monaco.editor.getModel(uri) ??
		monaco.editor.createModel(saved?.text ?? SCRATCH_DEFAULT, saved?.language ?? 'python', uri);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const write = (): void => {
		try {
			localStorage.setItem(
				SCRATCH_KEY,
				JSON.stringify({ text: model.getValue(), language: model.getLanguageId() }),
			);
		} catch {
			// Too big for local storage: the buffer still works for this session.
		}
	};
	const persist = (): void => {
		clearTimeout(timer);
		timer = setTimeout(write, 400);
	};
	const content = model.onDidChangeContent(persist);
	const language = model.onDidChangeLanguage(persist);
	// VS Code's services treat inmemory: models as borrowed: when any feature (hover, peek,
	// language client) takes a model reference and releases it, the model is destroyed under the
	// open editor. Holding our own reference until the tab closes keeps the buffer alive.
	let ref: Monaco.IDisposable | null = null;
	let closed = false;
	void import('@codingame/monaco-vscode-api/services')
		.then(({ getService, ITextModelService }) => getService(ITextModelService))
		.then((service) => service.createModelReference(uri))
		.then((r) => {
			if (closed) r.dispose();
			else ref = r;
		})
		.catch((error: unknown) => rlog.warn('editor', 'scratchpad model reference failed', error));
	tracked.set(SCRATCH_PATH, {
		model,
		savedVersion: model.getAlternativeVersionId(),
		listener: {
			dispose() {
				closed = true;
				clearTimeout(timer);
				if (!model.isDisposed()) write();
				content.dispose();
				language.dispose();
				ref?.dispose();
			},
		},
		viewStates: new Map(),
		bom: false,
		encoding: 'utf8',
	});
	store.add({
		path: SCRATCH_PATH,
		name: 'Scratchpad',
		state: 'ready',
		dirty: false,
		mtimeMs: 0,
		changedOnDisk: false,
	});
}
