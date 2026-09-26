import type { MonacoApi } from './setup';
import { buildUserConfiguration, type EditorPrefs } from './theme';

let pending: Promise<MonacoApi> | null = null;
let loaded: MonacoApi | null = null;
const loadedListeners = new Set<(monaco: MonacoApi) => void>();

/**
 * Lazily imports and boots the editor stack (~10 MB) the first time a file is opened, so app
 * startup doesn't pay for it. Safe to call repeatedly.
 */
export function loadMonaco(prefs: EditorPrefs): Promise<MonacoApi> {
	pending ??= import('./setup')
		.then((m) => m.setupMonaco(buildUserConfiguration(prefs)))
		.then((api) => {
			loaded = api;
			for (const listener of loadedListeners) listener(api);
			loadedListeners.clear();
			return api;
		})
		.catch((error: unknown) => {
			// Allow a retry after a failure instead of caching the rejection forever.
			pending = null;
			throw error;
		});
	return pending;
}

export function getLoadedMonaco(): MonacoApi | null {
	return loaded;
}

/**
 * Runs `listener` once Monaco is loaded (immediately if it already is), without triggering the
 * load itself — features like LSP stay dormant until the user actually opens a file.
 */
export function onMonacoLoaded(listener: (monaco: MonacoApi) => void): () => void {
	if (loaded) {
		listener(loaded);
		return () => undefined;
	}
	loadedListeners.add(listener);
	return () => loadedListeners.delete(listener);
}

/** Re-applies theme/font settings (accent changed, font size changed…). */
export async function refreshEditorConfiguration(prefs: EditorPrefs): Promise<void> {
	if (!loaded) return;
	const { applyUserConfiguration } = await import('./setup');
	await applyUserConfiguration(buildUserConfiguration(prefs));
}
