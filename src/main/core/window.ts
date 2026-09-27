import { join } from 'node:path';

import { app, BrowserWindow, Menu } from 'electron';
import log from 'electron-log/main';

import { APP_NAME, WINDOW_CHROME } from '@shared/constants';
import { type WindowChrome, WindowChromeSchema } from '@shared/ipc/channels/app';

import { APP_ORIGIN } from './app-protocol';
import { errorMessage } from './errors';
import { devRendererUrl } from './renderer-origin';
import { lockWindowNavigation } from './security';
import type { SettingsStore } from './store/json-store';
import { watchRenderer } from './window-recovery';
import { readWindowState, trackWindowState } from './window-state';

const CHROME_KEY = 'window:chrome';
const SHOW_FALLBACK_MS = 8_000;
const DEFAULT_CHROME: WindowChrome = { background: WINDOW_CHROME.background };

/** The palette's window background from the last session, so a light look starts light (no flash). */
export function readWindowChrome(store: SettingsStore): WindowChrome {
	return store.get(CHROME_KEY, WindowChromeSchema, DEFAULT_CHROME);
}

/**
 * Recolors the window background (seen while resizing and before the renderer paints) to the
 * active palette and remembers it. The window is frameless (ADR-015), so there is no native
 * caption-button overlay to recolor: the skin draws those buttons itself.
 */
export function applyWindowChrome(
	win: BrowserWindow,
	chrome: WindowChrome,
	store: SettingsStore,
): void {
	store.set(CHROME_KEY, WindowChromeSchema, chrome);
	win.setBackgroundColor(chrome.background);
}

/** The main window, restored to the theme colors, size, position and maximized state of last time. */
export function createMainWindow(store: SettingsStore): BrowserWindow {
	const chrome = readWindowChrome(store);
	const state = readWindowState(store);
	// No native menu: its default accelerators (Ctrl+W, Ctrl+R…) would fight app shortcuts.
	Menu.setApplicationMenu(null);

	const win = new BrowserWindow({
		...(state.bounds ?? { width: 1440, height: 900 }),
		minWidth: 960,
		minHeight: 600,
		title: APP_NAME,
		// Installed builds take the icon from the exe; dev runs need it spelled out.
		...(app.isPackaged ? {} : { icon: join(__dirname, '../../resources/installer/icon.png') }),
		show: false,
		backgroundColor: chrome.background,
		// Frameless: each skin draws its own title bar and window buttons (window-handlers.ts).
		titleBarStyle: 'hidden',
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			webSecurity: true,
		},
	});

	lockWindowNavigation(win);
	// If ready-to-show never fires (renderer stuck), still show the window rather than leave an
	// invisible process behind.
	const showFallback = setTimeout(() => {
		if (!win.isDestroyed() && !win.isVisible()) {
			log.warn('[window] ready-to-show did not fire; showing the window anyway');
			win.show();
		}
	}, SHOW_FALLBACK_MS);
	win.once('ready-to-show', () => {
		clearTimeout(showFallback);
		if (state.maximized) win.maximize();
		win.show();
	});
	trackWindowState(win, store);
	win.once('closed', () => clearTimeout(showFallback));

	const devUrl = devRendererUrl(app.isPackaged);
	const load = (): void => {
		// did-fail-load (window-recovery.ts) tells the user; the rejection only needs a trace.
		win.loadURL(devUrl ?? `${APP_ORIGIN}/index.html`).catch((error: unknown) =>
			log.warn('[window] loadURL rejected', errorMessage(error)),
		);
	};
	watchRenderer(win, load);

	// With the menu gone, keep devtools reachable in development only.
	if (devUrl) {
		win.webContents.on('before-input-event', (_event, input) => {
			if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
		});
	}

	load();
	return win;
}
