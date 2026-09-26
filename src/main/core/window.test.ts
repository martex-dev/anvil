import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

vi.mock('electron', () => ({ app: {}, BrowserWindow: {}, Menu: {}, net: {}, protocol: {} }));
vi.mock('electron-log/main', () => ({ default: { warn: vi.fn() } }));

import { WINDOW_CHROME } from '@shared/constants';

import type { SettingsStore } from './store/json-store';
import { applyWindowChrome, readWindowChrome } from './window';

function memoryStore(): SettingsStore {
	const data = new Map<string, unknown>();
	return {
		get: <S extends z.ZodType>(key: string, schema: S, fallback: z.output<S>): z.output<S> =>
			data.has(key) ? schema.parse(data.get(key)) : fallback,
		set: <S extends z.ZodType>(key: string, schema: S, value: z.input<S>): z.output<S> => {
			const parsed = schema.parse(value);
			data.set(key, parsed);
			return parsed;
		},
		delete: (key) => void data.delete(key),
	};
}

describe('window chrome', () => {
	it('starts from the default dark chrome', () => {
		expect(readWindowChrome(memoryStore())).toEqual({ background: WINDOW_CHROME.background });
	});

	it('recolors the window and remembers the palette background for the next launch', () => {
		const store = memoryStore();
		// Frameless (ADR-015): there is no native caption overlay to recolor.
		const win = { setBackgroundColor: vi.fn(), setTitleBarOverlay: vi.fn() };
		const light = { background: '#f4f1ea' };
		applyWindowChrome(win as never, light, store);
		expect(win.setBackgroundColor).toHaveBeenCalledWith('#f4f1ea');
		expect(win.setTitleBarOverlay).not.toHaveBeenCalled();
		expect(readWindowChrome(store)).toEqual(light);
	});
});
