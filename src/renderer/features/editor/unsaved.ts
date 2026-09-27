import { type UnsavedPrompt, useEditorStore } from './editor-store';
import { saveFile } from './file-ops';

/**
 * Asks Save / Don't Save / Cancel for dirty files before `action` (e.g. "closing the window").
 * Resolves true when it's safe to go ahead: nothing was dirty, every file saved, or the user
 * chose to discard. A newer prompt cancels an older one that's still open.
 */
export function askToSave(paths: readonly string[], action: string): Promise<boolean> {
	const store = useEditorStore.getState();
	const dirty = paths.filter((p) => store.files.some((f) => f.path === p && f.dirty));
	if (dirty.length === 0) return Promise.resolve(true);
	store.unsaved?.resolve(false);
	return new Promise((resolve) => {
		const prompt: UnsavedPrompt = {
			paths: dirty,
			action,
			resolve: (proceed) => {
				const current = useEditorStore.getState();
				if (current.unsaved === prompt) current.setUnsaved(null);
				resolve(proceed);
			},
		};
		store.setUnsaved(prompt);
	});
}

/** Every file with unsaved edits. */
export function dirtyPaths(): string[] {
	return useEditorStore
		.getState()
		.files.filter((f) => f.dirty)
		.map((f) => f.path);
}

/** Saves each file in turn; false if any of them didn't save (error or disk conflict). */
export async function saveEach(paths: readonly string[]): Promise<boolean> {
	let ok = true;
	for (const path of paths) if (!(await saveFile(path))) ok = false;
	return ok;
}
