import { join } from 'node:path';

import { app, BrowserWindow, Menu } from 'electron';

import { APP_NAME, WINDOW_CHROME } from '@shared/constants';
import { type WindowChrome, WindowChromeSchema } from '@shared/ipc/channels/app';

import { APP_ORIGIN } from './app-protocol';
import { lockWindowNavigation } from './security';
import type { SettingsStore } from './store/json-store';

const CHROME_KEY = 'window:chrome';
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

export function createMainWindow(chrome: WindowChrome = DEFAULT_CHROME): BrowserWindow {
	// No native menu: its default accelerators (Ctrl+W, Ctrl+R…) would fight app shortcuts.
	Menu.setApplicationMenu(null);

	const win = new BrowserWindow({
		width: 1440,
		height: 900,
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
	win.once('ready-to-show', () => win.show());

	const devUrl = process.env['ELECTRON_RENDERER_URL'];

	// With the menu gone, keep devtools reachable in development only.
	if (devUrl) {
		win.webContents.on('before-input-event', (_event, input) => {
			if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
		});
	}

	void win.loadURL(devUrl ?? `${APP_ORIGIN}/index.html`);

	return win;
}
