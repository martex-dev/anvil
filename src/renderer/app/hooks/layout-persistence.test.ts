import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LAYOUT_DEFAULTS, useLayoutStore } from '../../stores/layout-store';
import { installLayoutPersistence } from './layout-persistence';

const flush = async (): Promise<void> => {
	await vi.advanceTimersByTimeAsync(0);
};

describe('layout persistence', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		useLayoutStore.setState({ ...LAYOUT_DEFAULTS });
	});
	afterEach(() => vi.useRealTimers());

	it('keeps a toggle made before the saved layout arrives, and saves it', async () => {
		let resolve: (v: unknown) => void = () => undefined;
		const load = (): Promise<unknown> => new Promise((r) => (resolve = r));
		const save = vi.fn(() => Promise.resolve());
		const stop = installLayoutPersistence({ store: useLayoutStore, load, save, warn: vi.fn() });

		const closed = !LAYOUT_DEFAULTS.sideOpen;
		useLayoutStore.setState({ sideOpen: closed });
		resolve({ sideOpen: !closed, panelHeight: 333 });
		await flush();

		expect(useLayoutStore.getState().sideOpen).toBe(closed);
		expect(useLayoutStore.getState().panelHeight).toBe(333);
		await vi.advanceTimersByTimeAsync(400);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ sideOpen: closed }));
		stop();
	});

	it('logs a failed save instead of dropping it silently', async () => {
		const warn = vi.fn();
		const stop = installLayoutPersistence({
			store: useLayoutStore,
			load: () => Promise.resolve(undefined),
			save: () => Promise.reject(new Error('disk full')),
			warn,
		});
		await flush();
		useLayoutStore.setState({ panelOpen: !useLayoutStore.getState().panelOpen });
		await vi.advanceTimersByTimeAsync(400);
		expect(warn).toHaveBeenCalledWith('save failed', expect.any(Error));
		stop();
	});
});
