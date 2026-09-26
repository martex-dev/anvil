import type * as Monaco from 'monaco-editor';

import { getSettings } from '../../app/hooks/use-settings';
import { call, IpcCallError } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import type { MonacoApi } from '../../lib/monaco/setup';
import { toast } from '../../stores/toast-store';
import { markDirty, replaceText, type Tracked, tracked } from './buffers';
import { useEditorStore } from './editor-store';
import { cleanWhitespace, formatPython } from './format';
import { isScratch } from './scratchpad';

// Callers import the editor's buffer API from here; the pieces live in smaller modules.
export { getModel, getViewState, saveViewState } from './buffers';
export { formatPython } from './format';
export { isScratch, openScratch, SCRATCH_PATH } from './scratchpad';

function toUri(monaco: MonacoApi, root: string, path: string): Monaco.Uri {
	// Absolute file:// URIs are what language servers (Phase 2) expect.
	return monaco.Uri.file(`${root.replace(/\\/g, '/')}/${path}`);
}

/** Files VS Code's grammars don't claim but that read fine with a close cousin. */
function languageOverride(path: string): string | undefined {
	const name = path.split('/').at(-1)?.toLowerCase() ?? '';
	if (name === '.env' || name.startsWith('.env.') || name.endsWith('.env')) return 'ini';
	if (name.endsWith('.toml') || name === 'uv.lock' || name === 'poetry.lock') return 'ini';
	return undefined;
}

/**
 * The read in flight per path. Closing the tab (or the whole folder) drops it, so a read that
 * lands afterwards is discarded instead of creating a buffer nobody shows, or filling a
 * same-named file of the next folder with this one's content.
 */
const loads = new Map<string, symbol>();

export async function openFile(monaco: MonacoApi, root: string, path: string): Promise<void> {
	const store = useEditorStore.getState();
	const known = store.files.find((f) => f.path === path);
	// A failed read (file locked by another program) is retried; anything else is already open.
	// Which file is active is the tabs' call (EditorBridge), not the loader's.
	if (known && known.state !== 'error') return;
	if (known) store.update(path, { state: 'loading', error: undefined });
	else
		store.add({
			path,
			name: path.split('/').at(-1) ?? path,
			state: 'loading',
			dirty: false,
			mtimeMs: 0,
			changedOnDisk: false,
		});
	const load = Symbol(path);
	loads.set(path, load);
	try {
		const file = await call('fs:readFile', path);
		if (loads.get(path) !== load) return;
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
			viewStates: new Map(),
		};
		tracked.set(path, t);
		store.update(path, { state: 'ready', mtimeMs: file.mtimeMs });
	} catch (error) {
		rlog.warn('editor', `open failed: ${path}`, error);
		if (loads.get(path) !== load) return;
		store.update(path, {
			state: 'error',
			error: error instanceof Error ? error.message : String(error),
		});
	} finally {
		if (loads.get(path) === load) loads.delete(path);
	}
}

/** Saves one file if it has unsaved edits. With `force`, writes it even if it changed on disk. */
export async function saveFile(path: string, force = false): Promise<boolean> {
	const store = useEditorStore.getState();
	const t = tracked.get(path);
	const file = store.files.find((f) => f.path === path);
	if (!t || !file) return false;
	// The scratchpad saves itself to local storage as you type.
	if (isScratch(path)) return true;
	// Nothing to write: a habitual Ctrl+S must not touch the file (mtime, watcher, git status,
	// local history) or reformat code nobody edited.
	if (!file.dirty && !force) return true;
	if (getSettings().formatOnSave && path.endsWith('.py')) await formatPython(path, t.model);
	cleanWhitespace(t.model);
	try {
		const version = t.model.getAlternativeVersionId();
		const { mtimeMs } = await call('fs:writeFile', {
			path,
			content: t.model.getValue(),
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
		// An edit (not setValue) keeps the reload undoable.
		if (file.content !== t.model.getValue()) replaceText(t.model, file.content);
		t.savedVersion = t.model.getAlternativeVersionId();
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
	loads.delete(path);
	const t = tracked.get(path);
	if (t) {
		t.listener.dispose();
		// Releasing the scratchpad's reference may already have destroyed its model.
		if (!t.model.isDisposed()) t.model.dispose();
		tracked.delete(path);
	}
	useEditorStore.getState().remove(path);
}
