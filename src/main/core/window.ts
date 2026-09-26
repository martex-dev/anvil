import { join } from 'node:path';

import { app, BrowserWindow, dialog, Menu } from 'electron';
import log from 'electron-log/main';

import { APP_NAME, WINDOW_CHROME } from '@shared/constants';
import { type WindowChrome, WindowChromeSchema } from '@shared/ipc/channels/app';

import { APP_ORIGIN } from './app-protocol';
import { errorMessage } from './errors';
import { lockWindowNavigation } from './security';
import type { SettingsStore } from './store/json-store';
import { readWindowState, trackWindowState } from './window-state';

const CHROME_KEY = 'window:chrome';
const SHOW_FALLBACK_MS = 8_000;
const DEFAULT_CHROME: WindowChrome = {
	background: WINDOW_CHROME.background,
	symbol: WINDOW_CHROME.symbol,
};

/** The theme's chrome colors from the last session, so a light theme starts light (no flash). */
export function readWindowChrome(store: SettingsStore): WindowChrome {
	return store.get(CHROME_KEY, WindowChromeSchema, DEFAULT_CHROME);
}

/** Recolors the caption buttons and background to the renderer's theme and remembers them. */
export function applyWindowChrome(
	win: BrowserWindow,
	chrome: WindowChrome,
	store: SettingsStore,
): void {
	store.set(CHROME_KEY, WindowChromeSchema, chrome);
	win.setBackgroundColor(chrome.background);
	// The overlay only exists on Windows and Linux; macOS draws its own traffic lights.
	if (process.platform !== 'darwin') {
		win.setTitleBarOverlay({ color: chrome.background, symbolColor: chrome.symbol });
	}
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
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: chrome.background,
			symbolColor: chrome.symbol,
			height: WINDOW_CHROME.titleBarHeight,
		},
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
	watchRenderer(win);

	const devUrl = process.env['ELECTRON_RENDERER_URL'];

	// With the menu gone, keep devtools reachable in development only.
	if (devUrl) {
		win.webContents.on('before-input-event', (_event, input) => {
			if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
		});
	}

	win.loadURL(devUrl ?? `${APP_ORIGIN}/index.html`).catch((error: unknown) => {
		log.error('[window] loading the interface failed', error);
		if (win.isDestroyed()) return;
		win.show();
		dialog.showErrorBox('Anvil could not load its interface', errorMessage(error));
	});

	return win;
}

/** A crashed or killed renderer leaves a blank window: log why and offer a reload. */
function watchRenderer(win: BrowserWindow): void {
	win.webContents.on('render-process-gone', (_event, details) => {
		log.error('[window] renderer process gone', {
			reason: details.reason,
			exitCode: details.exitCode,
		});
		if (details.reason === 'clean-exit' || win.isDestroyed()) return;
		void dialog
			.showMessageBox(win, {
				type: 'error',
				title: APP_NAME,
				message: 'The Anvil window stopped working',
				detail: `Reason: ${details.reason}. Reloading restores the interface; unsaved editor changes in this window are lost.`,
				buttons: ['Reload', 'Close'],
				defaultId: 0,
				cancelId: 1,
			})
			.then(({ response }) => {
				if (win.isDestroyed()) return;
				if (response === 0) win.webContents.reload();
				else win.close();
			})
			.catch((error: unknown) => log.error('[window] crash dialog failed', error));
	});
	win.on('unresponsive', () => log.warn('[window] renderer is not responding'));
	win.on('responsive', () => log.info('[window] renderer is responding again'));
}
