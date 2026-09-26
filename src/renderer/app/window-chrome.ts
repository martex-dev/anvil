import type { WindowChrome } from '@shared/ipc/channels/app';

import { call } from '../lib/ipc';
import { rlog } from '../lib/log';
import { resolveToken } from '../lib/resolve-color';

let lastSent = '';

/** `#rrggbb` from a resolved token (drops any alpha; the native background is opaque). */
function opaque(hex: string): string {
	return hex.slice(0, 7);
}

/**
 * The native window background (seen before the renderer paints and while resizing) is set by
 * main, not CSS, so main recolors it from the palette's --bg-0 after every appearance change and
 * remembers it for the next launch.
 */
export function syncWindowChrome(): void {
	const chrome: WindowChrome = { background: opaque(resolveToken('--bg-0')) };
	if (chrome.background === lastSent) return;
	lastSent = chrome.background;
	call('app:setChrome', chrome).catch((error: unknown) => {
		lastSent = '';
		rlog.warn('app', 'could not recolor the window background', error);
	});
}
