import { app, type BrowserWindow, session, shell } from 'electron';
import log from 'electron-log/main';

/** Only plain https links may leave the app, and only into the system browser. */
export function isSafeExternalUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		return url.protocol === 'https:' && url.username === '' && url.password === '';
	} catch {
		return false;
	}
}

export function openExternalSafely(raw: string): void {
	if (isSafeExternalUrl(raw)) {
		void shell.openExternal(raw);
	} else {
		log.warn('[security] refused to open non-https external url', { url: raw.slice(0, 200) });
	}
}

/** App-wide rules that apply to every webContents, including future webviews. */
export function installGlobalSecurity(): void {
	app.on('web-contents-created', (_event, contents) => {
		contents.setWindowOpenHandler(({ url }) => {
			openExternalSafely(url);
			return { action: 'deny' };
		});
		contents.on('will-attach-webview', (event) => {
			// We use WebContentsView exclusively; <webview> tags are never allowed.
			event.preventDefault();
		});
	});

	// The app UI only needs to write to the clipboard ("Copy path"); no camera, mic, location…
	session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
		callback(permission === 'clipboard-sanitized-write');
	});
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
