import { app, type BrowserWindow, session, shell } from 'electron';
import log from 'electron-log/main';

import { AnvilError } from './errors';

/** Only plain https links may leave the app, and only into the system browser. */
export function isSafeExternalUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' && url.username === '' && url.password === '';
	} catch {
		return false;
	}
}

/** Opens a safe link in the system browser; throws AnvilError when refused or it fails. */
export async function openExternalSafely(raw: string): Promise<void> {
	if (!isSafeExternalUrl(raw)) {
		log.warn('[security] refused to open non-https external url', { url: raw.slice(0, 200) });
		throw new AnvilError('URL_REFUSED', 'Only https links can be opened');
	}
	try {
		await shell.openExternal(raw);
	} catch (error) {
		// No registered browser, or the launch failed.
		throw new AnvilError('OPEN_EXTERNAL_FAILED', 'Could not open the link', error);
	}
}

/** App-wide rules that apply to every webContents, including future webviews. */
export function installGlobalSecurity(): void {
	app.on('web-contents-created', (_event, contents) => {
		contents.setWindowOpenHandler(({ url }) => {
			// Fire and forget: the window is denied either way; a failure only needs logging.
			openExternalSafely(url).catch((error: unknown) =>
				log.warn('[security] window.open link not opened', { error: String(error) }),
			);
			return { action: 'deny' };
		});
		contents.on('will-attach-webview', (event) => {
			// We use WebContentsView exclusively; <webview> tags are never allowed.
			event.preventDefault();
		});
	});

	// Clipboard only (copy path, code snaps, "compare with clipboard"); no camera, mic, location…
	// The default session serves nothing but Anvil's own page.
	const allowed = new Set(['clipboard-sanitized-write', 'clipboard-read']);
	session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
		callback(allowed.has(permission));
	});
	session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
}

/** The main window must always show Anvil; any navigation away is blocked. */
export function lockWindowNavigation(win: BrowserWindow): void {
	win.webContents.on('will-navigate', (event, url) => {
		event.preventDefault();
		log.warn('[security] blocked navigation', { url: url.slice(0, 200) });
	});
	win.webContents.on('will-redirect', (event, url) => {
		event.preventDefault();
		log.warn('[security] blocked redirect', { url: url.slice(0, 200) });
	});
}
