export const APP_NAME = 'Anvil';

/**
 * Window chrome. The background shows before the renderer paints (it mirrors Cyber Glass
 * --bg-0; main can't read CSS). The title bar height is the default skins build on.
 */
export const WINDOW_CHROME = {
	background: '#05060A',
	titleBarHeight: 40,
} as const;

/**
 * Windows AppUserModelId: groups Anvil's taskbar entry and toasts under one identity.
 * electron-builder's `appId` must use the same value.
 */
export const APP_ID = 'dev.marto.anvil';

export const REPO_URL = 'https://github.com/martex-dev/anvil';
