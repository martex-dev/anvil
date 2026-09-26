import { type BrowserWindow, screen } from 'electron';
import { z } from 'zod';

import type { SettingsStore } from './store/json-store';

const RectSchema = z.object({
	x: z.number().int(),
	y: z.number().int(),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
});
export type Rect = z.infer<typeof RectSchema>;

const WindowStateSchema = z.object({ bounds: RectSchema, maximized: z.boolean() });
export type WindowState = z.infer<typeof WindowStateSchema>;

const STATE_KEY = 'window:state';
const SAVE_DELAY_MS = 500;
// Enough of the window must be on a screen to grab its title bar and drag it back.
const MIN_VISIBLE = { width: 120, height: 40 };

/**
 * The saved bounds when they still land on a connected display (a second monitor may be
 * gone, or the resolution changed); otherwise none, so Electron centers the default size.
 */
export function restorableState(
	saved: WindowState | null,
	workAreas: readonly Rect[],
): { bounds: Rect | null; maximized: boolean } {
	if (!saved) return { bounds: null, maximized: false };
	const b = saved.bounds;
	const visible = workAreas.some((area) => {
		const w = Math.min(b.x + b.width, area.x + area.width) - Math.max(b.x, area.x);
		const h = Math.min(b.y + b.height, area.y + area.height) - Math.max(b.y, area.y);
		return w >= MIN_VISIBLE.width && h >= MIN_VISIBLE.height;
	});
	return { bounds: visible ? b : null, maximized: saved.maximized };
}

export function readWindowState(store: SettingsStore): {
	bounds: Rect | null;
	maximized: boolean;
} {
	const saved = store.get(STATE_KEY, WindowStateSchema.nullable(), null);
	return restorableState(
		saved,
		screen.getAllDisplays().map((d) => d.workArea),
	);
}

/** Saves size, position and maximized state as the user changes them, and on close. */
export function trackWindowState(win: BrowserWindow, store: SettingsStore): void {
	let timer: NodeJS.Timeout | undefined;
	const save = (): void => {
		clearTimeout(timer);
		if (win.isDestroyed()) return;
		// Normal bounds are the restored size, so un-maximizing next launch lands somewhere sane.
		const { x, y, width, height } = win.getNormalBounds();
		store.set(STATE_KEY, WindowStateSchema, {
			bounds: {
				x: Math.round(x),
				y: Math.round(y),
				width: Math.round(width),
				height: Math.round(height),
			},
			maximized: win.isMaximized(),
		});
	};
	const later = (): void => {
		clearTimeout(timer);
		timer = setTimeout(save, SAVE_DELAY_MS);
	};
	win.on('resize', later);
	win.on('move', later);
	win.on('maximize', later);
	win.on('unmaximize', later);
	win.on('close', save);
}
