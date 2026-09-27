import { getSettings } from '../../app/hooks/use-settings';
import { useEditorStore } from './editor-store';
import { isScratch, saveFile } from './file-ops';

/**
 * A file auto save may write: dirty, and not in a state that needs your decision (changed or
 * deleted on disk behind your back). Those wait for an explicit Ctrl+S.
 */
function autoSavable(path: string): boolean {
	const file = useEditorStore.getState().files.find((f) => f.path === path);
	return Boolean(
		file?.dirty && file.state === 'ready' && !file.changedOnDisk && !isScratch(path),
	);
}

const save = (path: string): void => {
	// Format-on-save would move code under your cursor mid-thought; auto saves skip it.
	if (autoSavable(path)) void saveFile(path, false, { format: false });
};

/**
 * Auto save (Settings → Editor): 'afterDelay' saves a file a moment after its last change;
 * 'onFocusChange' saves when you switch to another file or leave the window. Returns a cleanup.
 */
export function startAutoSave(): () => void {
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	// The content version each dirty file's timer was armed at. Kept after the timer fires, so a
	// save that failed isn't retried on every cursor move, only after the next edit.
	const armedAt = new Map<string, number>();
	let active = useEditorStore.getState().active;

	const offStore = useEditorStore.subscribe((s) => {
		const { autoSave, autoSaveDelayMs } = getSettings();
		if (autoSave === 'onFocusChange' && s.active !== active) {
			if (active) save(active);
			active = s.active;
		}
		for (const path of armedAt.keys())
			if (!s.files.some((f) => f.path === path && f.dirty)) armedAt.delete(path);
		if (autoSave !== 'afterDelay') return;
		// contentVersion is bumped (debounced) as you type, so re-arming on each bump fires the
		// save a delay after the last keystroke.
		for (const f of s.files) {
			if (!f.dirty || armedAt.get(f.path) === s.contentVersion) continue;
			armedAt.set(f.path, s.contentVersion);
			clearTimeout(timers.get(f.path));
			timers.set(
				f.path,
				setTimeout(() => {
					timers.delete(f.path);
					save(f.path);
				}, autoSaveDelayMs),
			);
		}
	});

	const onBlur = (): void => {
		if (getSettings().autoSave === 'off') return;
		for (const f of useEditorStore.getState().files) save(f.path);
	};
	window.addEventListener('blur', onBlur);

	return () => {
		offStore();
		window.removeEventListener('blur', onBlur);
		for (const t of timers.values()) clearTimeout(t);
	};
}
