import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LoadModule from './load';
import type { MonacoApi } from './setup';

const setupMonaco = vi.fn((_config: string) => Promise.resolve({} as MonacoApi));
const applyUserConfiguration = vi.fn((_config: string) => Promise.resolve());
vi.mock('./setup', () => ({
	setupMonaco: (config: string) => setupMonaco(config),
	applyUserConfiguration: (config: string) => applyUserConfiguration(config),
}));
vi.mock('./theme', () => ({
	buildUserConfiguration: (prefs: { editorFontSize: number }) => `size:${prefs.editorFontSize}`,
}));
const logError = vi.fn();
vi.mock('../log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: logError } }));

type Load = typeof LoadModule;
const prefs = (editorFontSize: number): Parameters<Load['loadMonaco']>[0] =>
	({ editorFontSize }) as Parameters<Load['loadMonaco']>[0];

// Each test gets a fresh module, i.e. a Monaco that hasn't booted yet.
async function freshLoad(): Promise<Load> {
	vi.resetModules();
	return import('./load');
}

describe('loadMonaco', () => {
	beforeEach(() => {
		setupMonaco.mockClear();
		applyUserConfiguration.mockClear();
		logError.mockClear();
	});

	it('still loads, and notifies the other listeners, when one listener throws', async () => {
		const { loadMonaco, onMonacoLoaded, getLoadedMonaco } = await freshLoad();
		const good = vi.fn();
		onMonacoLoaded(() => {
			throw new Error('bad listener');
		});
		onMonacoLoaded(good);
		const api = await loadMonaco(prefs(13));
		expect(getLoadedMonaco()).toBe(api);
		expect(good).toHaveBeenCalledWith(api);
		expect(logError).toHaveBeenCalledOnce();
		// Later calls reuse the booted stack instead of initializing the services again.
		await loadMonaco(prefs(13));
		expect(setupMonaco).toHaveBeenCalledOnce();
	});

	it('retries the boot after it fails', async () => {
		const { loadMonaco } = await freshLoad();
		setupMonaco.mockRejectedValueOnce(new Error('boom'));
		await expect(loadMonaco(prefs(13))).rejects.toThrow('boom');
		await expect(loadMonaco(prefs(13))).resolves.toBeDefined();
		expect(setupMonaco).toHaveBeenCalledTimes(2);
	});
});

describe('refreshEditorConfiguration', () => {
	beforeEach(() => {
		setupMonaco.mockClear();
		applyUserConfiguration.mockClear();
	});

	it('does nothing before a load has started', async () => {
		const { refreshEditorConfiguration } = await freshLoad();
		await refreshEditorConfiguration(prefs(20));
		expect(applyUserConfiguration).not.toHaveBeenCalled();
	});

	it('applies settings changed during the boot once it finishes', async () => {
		const { loadMonaco, refreshEditorConfiguration } = await freshLoad();
		let finish: (api: MonacoApi) => void = () => undefined;
		setupMonaco.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
		const loading = loadMonaco(prefs(13));
		const refreshing = refreshEditorConfiguration(prefs(20));
		await Promise.resolve();
		expect(applyUserConfiguration).not.toHaveBeenCalled();
		finish({} as MonacoApi);
		await loading;
		await refreshing;
		expect(setupMonaco).toHaveBeenCalledWith('size:13');
		expect(applyUserConfiguration).toHaveBeenCalledWith('size:20');
	});

	it('skips the refresh when the boot fails', async () => {
		const { loadMonaco, refreshEditorConfiguration } = await freshLoad();
		setupMonaco.mockRejectedValueOnce(new Error('boom'));
		const loading = loadMonaco(prefs(13));
		const refreshing = refreshEditorConfiguration(prefs(20));
		await expect(loading).rejects.toThrow('boom');
		await refreshing;
		expect(applyUserConfiguration).not.toHaveBeenCalled();
	});
});
