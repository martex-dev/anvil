import type { BrowserWindow } from 'electron';

import type { WindowState } from '@shared/ipc/channels/window';

import { emitEvent, router } from './ipc';

const stateOf = (win: BrowserWindow): WindowState => ({
	maximized: win.isMaximized(),
	focused: win.isFocused(),
	fullScreen: win.isFullScreen(),
});

/**
 * Unsaved-files guard. The page reports how many files are dirty; while any are, a close or
 * reload is held back and the page asks Save / Don't Save / Cancel, then calls
 * window:proceedUnload. Kept in main (not `beforeunload`) so a crashed or reloading page can
 * never trap the window open: the count resets whenever the page goes away.
 */
let unsaved = 0;
let allowUnload = false;
let pendingIntent: 'close' | 'reload' = 'close';

/** Lets the next close through without asking (restart to update, after the page asked). */
export function allowNextUnload(): void {
	allowUnload = true;
}

function holdBack(intent: 'close' | 'reload'): boolean {
	if (allowUnload || unsaved === 0) return false;
	pendingIntent = intent;
	emitEvent('window:closeRequested', { intent });
	return true;
}

/** Reloads the page, asking about unsaved files first. */
export function reloadWindow(win: BrowserWindow): void {
	if (holdBack('reload')) return;
	win.webContents.reload();
}

const CLOSED: WindowState = { maximized: false, focused: false, fullScreen: false };

/** Minimize / maximize / close for skin-drawn window buttons. Registered once. */
export function registerWindowHandlers(current: () => BrowserWindow | null): void {
	router.handle('window:state', () => {
		const win = current();
		return win ? stateOf(win) : CLOSED;
	});
	router.handle('window:minimize', () => current()?.minimize());
	router.handle('window:toggleMaximize', () => {
		const win = current();
		if (!win) return CLOSED;
		if (win.isMaximized()) win.unmaximize();
		else win.maximize();
		return stateOf(win);
	});
	router.handle('window:close', () => current()?.close());
	router.handle('window:setUnsaved', (count) => {
		unsaved = count;
	});
	router.handle('window:proceedUnload', () => {
		const win = current();
		if (!win) return;
		if (pendingIntent === 'reload') {
			unsaved = 0;
			win.webContents.reload();
			return;
		}
		allowUnload = true;
		win.close();
	});
}

/** Pushes maximize / focus / full-screen changes so the skin's buttons stay in sync. */
export function watchWindowState(win: BrowserWindow): void {
	// Every close attempt (buttons, Alt+F4, the taskbar, quitting) runs the unsaved check.
	win.on('close', (event) => {
		if (holdBack('close')) event.preventDefault();
	});
	// A new or crashed page has no unsaved buffers of its own; it reports again once it has.
	win.webContents.on('did-start-navigation', (details) => {
		if (details.isMainFrame && !details.isSameDocument) unsaved = 0;
	});
	win.webContents.on('render-process-gone', () => {
		unsaved = 0;
	});
	const push = (): void => {
		if (!win.isDestroyed()) emitEvent('window:changed', stateOf(win));
	};
	win.on('maximize', push);
	win.on('unmaximize', push);
	win.on('focus', push);
	win.on('blur', push);
	win.on('enter-full-screen', push);
	win.on('leave-full-screen', push);
}
