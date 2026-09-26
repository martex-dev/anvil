import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ screen: {} }));

import { restorableState } from './window-state';

const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const right = { x: 1920, y: 0, width: 2560, height: 1400 };

describe('restorableState', () => {
	it('uses the default size on first launch', () => {
		expect(restorableState(null, [primary])).toEqual({ bounds: null, maximized: false });
	});

	it('restores bounds on a second monitor that is still connected', () => {
		const bounds = { x: 2100, y: 80, width: 1600, height: 1000 };
		expect(restorableState({ bounds, maximized: true }, [primary, right])).toEqual({
			bounds,
			maximized: true,
		});
	});

	it('drops bounds that no longer land on any display but keeps maximized', () => {
		const bounds = { x: 2100, y: 80, width: 1600, height: 1000 };
		expect(restorableState({ bounds, maximized: true }, [primary])).toEqual({
			bounds: null,
			maximized: true,
		});
	});

	it('drops bounds with only a sliver on screen', () => {
		const bounds = { x: 1900, y: 100, width: 1200, height: 800 };
		expect(restorableState({ bounds, maximized: false }, [primary]).bounds).toBeNull();
	});
});
