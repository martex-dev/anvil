import { useEditorStore } from '../editor/editor-store';
import { isScratch, saveFile } from '../editor/file-ops';

/**
 * Saves every unsaved file so tests and tasks run the code that is on screen. False when a save
 * failed; saveFile has already shown why (an error toast or the conflict banner).
 */
export async function saveDirtyFiles(): Promise<boolean> {
	let ok = true;
	for (const f of useEditorStore.getState().files) {
		if (!f.dirty || isScratch(f.path)) continue;
		if (!(await saveFile(f.path))) ok = false;
	}
	return ok;
}
