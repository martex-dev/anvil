export const APP_NAME = 'Anvil';

/**
 * Default native window chrome colors, used until the renderer reports the active theme's
 * (app:setChrome). Main can't read CSS variables, so these mirror the default theme's --bg-0
 * and --text-1 in themes.css. Keep them in sync if the tokens change.
 */
export const WINDOW_CHROME = {
	background: '#05060A',
	symbol: '#9AA8C0',
	titleBarHeight: 40,
} as const;

/**
 * Windows AppUserModelId: groups Anvil's taskbar entry and toasts under one identity.
 * electron-builder's `appId` must use the same value.
 */
export const APP_ID = 'dev.marto.anvil';

export const REPO_URL = 'https://github.com/martex-dev/anvil';
