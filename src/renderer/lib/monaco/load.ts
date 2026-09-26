import { rlog } from '../log';
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
	if (loaded) return Promise.resolve(loaded);
	pending ??= import('./setup')
		.then((m) => m.setupMonaco(buildUserConfiguration(prefs)))
		.catch((error: unknown) => {
			// Allow a retry after a failed boot instead of caching the rejection forever. Only the
			// boot itself resets: once VS Code's services are initialized they can't be again.
			pending = null;
			throw error;
		})
		.then((api) => {
			loaded = api;
			notifyLoaded(api);
			return api;
		});
	return pending;
}

/** One faulty listener must not fail the load (which would leave the editor unrecoverable). */
function notifyLoaded(api: MonacoApi): void {
	const listeners = [...loadedListeners];
	loadedListeners.clear();
	for (const listener of listeners) {
		try {
			listener(api);
		} catch (error) {
			rlog.error('editor', 'a Monaco load listener failed', error);
		}
	}
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
