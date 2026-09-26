import type { FileContent } from '@shared/ipc/channels/fs';

import { getSettings } from '../../app/hooks/use-settings';
import { call, IpcCallError } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import type { MonacoApi } from '../../lib/monaco/setup';
import { toast } from '../../stores/toast-store';
import { languageOverride, markDirty, replaceText, toUri, type Tracked, tracked } from './buffers';
import { useEditorStore } from './editor-store';
import { cleanWhitespace, formatPython } from './format';
import { isScratch } from './scratchpad';

// Callers import the editor's buffer API from here; the pieces live in smaller modules.
export { getModel, getViewState, languageOverride, saveViewState } from './buffers';
export { formatPython } from './format';
export { isScratch, openScratch, SCRATCH_PATH } from './scratchpad';

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

/**
 * Saves in flight per path. A second save (Ctrl+S held down, Save then Save All) waits for the
 * first; sent together, it would carry the mtime from before the first write and fail as a
 * conflict with Anvil's own save.
 */
const saving = new Map<string, Promise<boolean>>();

/** Saves one file if it has unsaved edits. With `force`, writes it even if it changed on disk. */
export function saveFile(path: string, force = false): Promise<boolean> {
	const previous = saving.get(path) ?? Promise.resolve(true);
	const run = (): Promise<boolean> => writeBuffer(path, force);
	const next = previous.then(run, run);
	saving.set(path, next);
	const settle = (): void => {
		if (saving.get(path) === next) saving.delete(path);
	};
	void next.then(settle, settle);
	return next;
}

async function writeBuffer(path: string, force: boolean): Promise<boolean> {
	const store = useEditorStore.getState();
	const t = tracked.get(path);
	const known = store.files.find((f) => f.path === path);
	if (!t || !known) return false;
	// The scratchpad saves itself to local storage as you type.
	if (isScratch(path)) return true;
	// Nothing to write: a habitual Ctrl+S must not touch the file (mtime, watcher, git status,
	// local history) or reformat code nobody edited.
	if (!known.dirty && !force) return true;
	if (getSettings().formatOnSave && path.endsWith('.py'))
		await formatPython(path, t.model, { onSave: true });
	// Closed while ruff ran: nothing left to save.
	const file = useEditorStore.getState().files.find((f) => f.path === path);
	if (tracked.get(path) !== t || !file) return false;
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
			store.queueConflict(path);
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
	const unsaved: string[] = [];
	for (const f of useEditorStore.getState().files) {
		if (f.dirty && !(await saveFile(f.path))) unsaved.push(f.name);
	}
	// Each failure has its own dialog or toast; this says how many are still unsaved overall.
	if (unsaved.length > 1)
		toast.warn(`${unsaved.length} files were not saved`, unsaved.join(', '));
}

/**
 * Puts the disk version into the buffer, unless the buffer was closed or edited while the read
 * was in flight: then the new keystrokes stay and the tab is flagged as changed on disk.
 */
function applyDiskVersion(path: string, t: Tracked, file: FileContent, version: number): void {
	if (tracked.get(path) !== t) return;
	if (t.model.getAlternativeVersionId() !== version) {
		useEditorStore.getState().update(path, { changedOnDisk: true });
		return;
	}
	// An edit (not setValue) keeps the reload undoable.
	if (file.content !== t.model.getValue()) replaceText(t.model, file.content);
	t.savedVersion = t.model.getAlternativeVersionId();
	useEditorStore.getState().update(path, { mtimeMs: file.mtimeMs, changedOnDisk: false });
	markDirty(path);
}

/** Replaces the buffer with the disk version ("Reload from Disk", "Load Disk Version"). */
export async function reloadFromDisk(path: string): Promise<void> {
	const t = tracked.get(path);
	if (!t) return;
	const version = t.model.getAlternativeVersionId();
	const name = path.split('/').at(-1) ?? path;
	try {
		const file = await call('fs:readFile', path);
		if (file.binary || file.tooLarge) {
			toast.warn(
				`Couldn't reload ${name}`,
				`The file on disk is now ${file.binary ? 'binary' : 'too large to edit'}. Your version is kept.`,
			);
			useEditorStore.getState().update(path, { changedOnDisk: true });
			return;
		}
		applyDiskVersion(path, t, file, version);
	} catch (error) {
		// The file was deleted or became unreadable; keep the buffer so nothing is lost.
		rlog.warn('editor', `reload failed: ${path}`, error);
		toast.error(`Couldn't reload ${name}`, error instanceof Error ? error.message : undefined);
		useEditorStore.getState().update(path, { changedOnDisk: true });
	}
}

/** Same mtime as the version we hold (1 ms tolerance: some filesystems round mtimes). */
const sameMtime = (a: number, b: number): boolean => Math.abs(a - b) <= 1;

/**
 * A watcher report for an open file. The echo of Anvil's own save (same mtime as the version we
 * hold) is ignored; otherwise a clean buffer follows disk and a dirty one gets flagged.
 */
async function followDisk(path: string): Promise<void> {
	try {
		// Judge a save's echo against the mtime that save writes, not the one before it.
		await saving.get(path);
		const t = tracked.get(path);
		if (!t) return;
		const version = t.model.getAlternativeVersionId();
		const file = await call('fs:readFile', path);
		const known = useEditorStore.getState().files.find((f) => f.path === path);
		if (!known || known.state !== 'ready' || sameMtime(file.mtimeMs, known.mtimeMs)) return;
		if (known.dirty || file.binary || file.tooLarge) {
			useEditorStore.getState().update(path, { changedOnDisk: true });
			return;
		}
		applyDiskVersion(path, t, file, version);
	} catch (error) {
		// Deleted or unreadable: keep the buffer and flag it.
		rlog.warn('editor', `reload failed: ${path}`, error);
		useEditorStore.getState().update(path, { changedOnDisk: true });
	}
}

/** Called for files the watcher reports as changed. */
export function onExternalChange(paths: readonly string[]): void {
	const { files } = useEditorStore.getState();
	for (const path of paths) {
		if (files.some((f) => f.path === path && f.state === 'ready')) void followDisk(path);
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
