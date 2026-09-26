import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { app, BrowserWindow, shell } from 'electron';
import log from 'electron-log/main';
import { z } from 'zod';

import type { FeatureFailure } from '@shared/ipc/channels/app';
import { parseSettings, type Settings, SettingsSchema } from '@shared/settings';

import { AnvilError } from './errors';
import { emitEvent, router } from './ipc';
import { openExternalSafely } from './security';
import type { SettingsStore } from './store/json-store';
import { applyWindowChrome } from './window';

const UiStateSchema = z.record(z.string(), z.unknown());

const window = (): BrowserWindow | undefined =>
	BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

const RawSettingsSchema = z.unknown();
// readSettings runs on every file save; report a given set of bad fields once, not each time.
let reportedInvalid = '';

/** Validates per field, so one bad value resets only itself (and the next update persists that). */
export function readSettings(store: SettingsStore): Settings {
	const { settings, invalid } = parseSettings(
		store.get('settings', RawSettingsSchema, undefined),
	);
	const signature = invalid.join(',');
	if (signature && signature !== reportedInvalid) {
		log.warn('[settings] invalid values replaced by defaults', { keys: invalid });
	}
	reportedInvalid = signature;
	return settings;
}

export function registerAppHandlers(
	store: SettingsStore,
	featureFailures: () => readonly FeatureFailure[],
): void {
	router.handle('app:featureErrors', () => [...featureFailures()]);
	router.handle('app:getVersion', () => app.getVersion());
	router.handle('app:getPlatform', () => process.platform);
	router.handle('app:reloadWindow', () => {
		window()?.webContents.reload();
	});
	router.handle('app:toggleFullScreen', () => {
		const win = window();
		if (!win) return false;
		win.setFullScreen(!win.isFullScreen());
		return win.isFullScreen();
	});
	router.handle('app:toggleDevTools', () => {
		window()?.webContents.toggleDevTools();
	});
	router.handle('app:metrics', () => {
		// CPU percent is per core, as in Task Manager's per-process view before normalising.
		const metrics = app.getAppMetrics();
		const memoryKb = metrics.reduce((sum, m) => sum + m.memory.workingSetSize, 0);
		const cpu = metrics.reduce((sum, m) => sum + m.cpu.percentCPUUsage, 0);
		return {
			memoryMb: Math.round(memoryKb / 1024),
			cpuPercent: Math.round(cpu * 10) / 10,
			processes: metrics.length,
		};
	});
	router.handle('app:openLogs', async () => {
		const dir = join(app.getPath('userData'), 'logs');
		// The folder only exists after the first log write; create it so Explorer has a target.
		mkdirSync(dir, { recursive: true });
		// openPath resolves with an error string instead of rejecting.
		const failure = await shell.openPath(dir);
		if (failure)
			throw new AnvilError('OPEN_FAILED', `Could not open the log folder: ${failure}`);
	});
	router.handle('app:setChrome', (chrome) => {
		const win = window();
		if (win) applyWindowChrome(win, chrome, store);
	});
	router.handle('app:openExternal', (url) => openExternalSafely(url));
	router.handle('app:log', ({ level, scope, message, detail }) => {
		log.scope(`renderer:${scope}`)[level](message, detail ?? '');
	});

	router.handle('settings:get', () => readSettings(store));
	router.handle('settings:update', (patch) => {
		const next = store.set('settings', SettingsSchema, { ...readSettings(store), ...patch });
		emitEvent('settings:changed', next);
		return next;
	});
	router.handle('ui:getState', () => store.get('ui', UiStateSchema, {}));
	router.handle('ui:setState', (state) => {
		store.set('ui', UiStateSchema, state);
	});
}
