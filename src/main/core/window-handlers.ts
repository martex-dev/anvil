import type { BrowserWindow } from 'electron';

import type { WindowState } from '@shared/ipc/channels/window';

import { emitEvent, router } from './ipc';

const stateOf = (win: BrowserWindow): WindowState => ({
	maximized: win.isMaximized(),
	focused: win.isFocused(),
	fullScreen: win.isFullScreen(),
});

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
}

/** Pushes maximize / focus / full-screen changes so the skin's buttons stay in sync. */
export function watchWindowState(win: BrowserWindow): void {
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
