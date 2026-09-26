import { join } from 'node:path';

import { app, BrowserWindow, Menu } from 'electron';

import { APP_NAME, WINDOW_CHROME } from '@shared/constants';

import { APP_ORIGIN } from './app-protocol';
import { lockWindowNavigation } from './security';

export function createMainWindow(): BrowserWindow {
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
		backgroundColor: WINDOW_CHROME.background,
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
