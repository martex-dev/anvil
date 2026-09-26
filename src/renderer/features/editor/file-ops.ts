import type * as Monaco from 'monaco-editor';

import { getSettings } from '../../app/hooks/use-settings';
import { call, IpcCallError } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import type { MonacoApi } from '../../lib/monaco/setup';
import { toast } from '../../stores/toast-store';
import { useEditorStore } from './editor-store';

interface Tracked {
	model: Monaco.editor.ITextModel;
	/** Alternative version id at last load/save; differs from the current one when dirty. */
	savedVersion: number;
	listener: Monaco.IDisposable;
	viewState: Monaco.editor.ICodeEditorViewState | null;
	/** The file on disk starts with a UTF-8 BOM; saves keep it. */
	bom: boolean;
}

const tracked = new Map<string, Tracked>();

export function getModel(path: string): Monaco.editor.ITextModel | null {
	return tracked.get(path)?.model ?? null;
}

export function saveViewState(
	path: string,
	state: Monaco.editor.ICodeEditorViewState | null,
): void {
	const t = tracked.get(path);
	if (t) t.viewState = state;
}

export function getViewState(path: string): Monaco.editor.ICodeEditorViewState | null {
	return tracked.get(path)?.viewState ?? null;
}

function toUri(monaco: MonacoApi, root: string, path: string): Monaco.Uri {
	// Absolute file:// URIs are what language servers (Phase 2) expect.
	return monaco.Uri.file(`${root.replace(/\\/g, '/')}/${path}`);
}

function markDirty(path: string): void {
	const t = tracked.get(path);
	if (!t) return;
	useEditorStore
		.getState()
		.update(path, { dirty: t.model.getAlternativeVersionId() !== t.savedVersion });
}

/** Files VS Code's grammars don't claim but that read fine with a close cousin. */
function languageOverride(path: string): string | undefined {
	const name = path.split('/').at(-1)?.toLowerCase() ?? '';
	if (name === '.env' || name.startsWith('.env.') || name.endsWith('.env')) return 'ini';
	if (name.endsWith('.toml') || name === 'uv.lock' || name === 'poetry.lock') return 'ini';
	return undefined;
}

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
		viewState: null,
		bom: false,
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

/** Whitespace hygiene on save, as one undoable edit. */
function cleanWhitespace(model: Monaco.editor.ITextModel): void {
	const { trimTrailingWhitespace, insertFinalNewline } = getSettings();
	if (!trimTrailingWhitespace && !insertFinalNewline) return;
	const before = model.getValue();
	const eol = model.getEOL();
	let after = before;
	if (trimTrailingWhitespace) after = after.replace(/[ \t]+(?=\r?\n|$)/g, '');
	if (insertFinalNewline && after.length > 0 && !after.endsWith('\n')) after += eol;
	if (after !== before) {
		model.pushEditOperations(
			[],
			[{ range: model.getFullModelRange(), text: after }],
			() => null,
		);
	}
}

export async function openFile(monaco: MonacoApi, root: string, path: string): Promise<void> {
	const store = useEditorStore.getState();
	if (store.files.some((f) => f.path === path)) {
		store.setActive(path);
		return;
	}
	store.add({
		path,
		name: path.split('/').at(-1) ?? path,
		state: 'loading',
		dirty: false,
		mtimeMs: 0,
		changedOnDisk: false,
	});
	try {
		const file = await call('fs:readFile', path);
		if (file.binary || file.tooLarge) {
			store.update(path, {
				state: file.binary ? 'binary' : 'tooLarge',
				mtimeMs: file.mtimeMs,
			});
			return;
		}
		const uri = toUri(monaco, root, path);
		// Language features (go to definition) may already have loaded this file as a model.
		const existing = monaco.editor.getModel(uri);
		if (existing && existing.getValue() !== file.content) existing.setValue(file.content);
		const model =
			existing ?? monaco.editor.createModel(file.content, languageOverride(path), uri);
		model.setEOL(
			file.eol === '\r\n'
				? monaco.editor.EndOfLineSequence.CRLF
				: monaco.editor.EndOfLineSequence.LF,
		);
		const t: Tracked = {
			model,
			savedVersion: model.getAlternativeVersionId(),
			listener: model.onDidChangeContent(() => markDirty(path)),
			viewState: null,
			bom: file.bom,
		};
		tracked.set(path, t);
		store.update(path, { state: 'ready', mtimeMs: file.mtimeMs });
	} catch (error) {
		rlog.warn('editor', `open failed: ${path}`, error);
		store.update(path, {
			state: 'error',
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Formats a Python buffer with ruff in place, as one undoable edit. A formatting failure
 * (syntax error, ruff missing) is reported but never blocks the save itself.
 */
export async function formatPython(
	path: string,
	model: Monaco.editor.ITextModel,
): Promise<boolean> {
	try {
		const before = model.getValue();
		const { content } = await call('python:format', { path, content: before });
		if (content !== before && model.getValue() === before) {
			model.pushEditOperations(
				[],
				[{ range: model.getFullModelRange(), text: content }],
				() => null,
			);
		}
		return true;
	} catch (error) {
		toast.warn('Format skipped', error instanceof Error ? error.message : undefined);
		return false;
	}
}

/** Saves one file. With `force`, overwrites even if it changed on disk. */
export async function saveFile(path: string, force = false): Promise<boolean> {
	const store = useEditorStore.getState();
	const t = tracked.get(path);
	const file = store.files.find((f) => f.path === path);
	if (!t || !file) return false;
	// The scratchpad saves itself to local storage as you type.
	if (isScratch(path)) return true;
	if (getSettings().formatOnSave && path.endsWith('.py')) await formatPython(path, t.model);
	cleanWhitespace(t.model);
	try {
		const version = t.model.getAlternativeVersionId();
		const { mtimeMs } = await call('fs:writeFile', {
			path,
			content: t.model.getValue(),
			bom: t.bom,
			...(force ? {} : { expectedMtimeMs: file.mtimeMs }),
		});
		t.savedVersion = version;
		store.update(path, { mtimeMs, changedOnDisk: false });
		markDirty(path);
		return true;
	} catch (error) {
		if (error instanceof IpcCallError && error.code === 'FS_CONFLICT') {
			store.setConflict(path);
			return false;
		}
		rlog.error('editor', `save failed: ${path}`, error);
		toast.error(
			`Could not save ${file.name}`,
			error instanceof Error ? error.message : undefined,
		);
		return false;
	}
}

export async function saveAll(): Promise<void> {
	for (const f of useEditorStore.getState().files) if (f.dirty) await saveFile(f.path);
}

/** Replaces the buffer with the disk version (used for external changes and "Reload"). */
export async function reloadFromDisk(path: string): Promise<void> {
	const t = tracked.get(path);
	if (!t) return;
	try {
		const file = await call('fs:readFile', path);
		if (file.binary || file.tooLarge) return;
		if (file.content !== t.model.getValue()) {
			// pushEditOperations keeps the reload undoable, unlike setValue.
			t.model.pushEditOperations(
				[],
				[{ range: t.model.getFullModelRange(), text: file.content }],
				() => null,
			);
		}
		t.savedVersion = t.model.getAlternativeVersionId();
		t.bom = file.bom;
		useEditorStore.getState().update(path, { mtimeMs: file.mtimeMs, changedOnDisk: false });
		markDirty(path);
	} catch (error) {
		// The file was deleted or became unreadable; keep the buffer so nothing is lost.
		rlog.warn('editor', `reload failed: ${path}`, error);
		useEditorStore.getState().update(path, { changedOnDisk: true });
	}
}

/** Called for files the watcher reports as changed. Clean buffers follow disk; dirty ones get flagged. */
export function onExternalChange(paths: readonly string[]): void {
	const store = useEditorStore.getState();
	for (const path of paths) {
		const file = store.files.find((f) => f.path === path);
		if (!file || file.state !== 'ready') continue;
		if (file.dirty) store.update(path, { changedOnDisk: true });
		else void reloadFromDisk(path);
	}
}

export function closeFile(path: string): void {
	const t = tracked.get(path);
	if (t) {
		t.listener.dispose();
		// Releasing the scratchpad's reference may already have destroyed its model.
		if (!t.model.isDisposed()) t.model.dispose();
		tracked.delete(path);
	}
	useEditorStore.getState().remove(path);
}
