import type { WindowChrome } from '@shared/ipc/channels/app';

import { call } from '../lib/ipc';
import { rlog } from '../lib/log';
import { resolveToken } from '../lib/resolve-color';

let lastSent = '';

/** `#rrggbb` from a resolved token (drops any alpha; the native overlay is opaque). */
function opaque(hex: string): string {
	return hex.slice(0, 7);
}

/**
 * The native caption buttons (minimize/maximize/close) are drawn by the OS, not CSS, so main
 * recolors them from the theme's --bg-0 / --text-1 after every appearance change.
 */
export function syncWindowChrome(): void {
	const chrome: WindowChrome = {
		background: opaque(resolveToken('--bg-0')),
		symbol: opaque(resolveToken('--text-1')),
	};
	const key = `${chrome.background}${chrome.symbol}`;
	if (key === lastSent) return;
	lastSent = key;
	call('app:setChrome', chrome).catch((error: unknown) => {
		lastSent = '';
		rlog.warn('app', 'could not recolor the window title bar', error);
	});
}
