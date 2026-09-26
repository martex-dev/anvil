import { beforeEach, describe, expect, it } from 'vitest';

import { fitWidths, LAYOUT_DEFAULTS, MIN_EDITOR_WIDTH, useLayoutStore } from './layout-store';

beforeEach(() => useLayoutStore.setState(LAYOUT_DEFAULTS));

describe('toggleAi', () => {
	it('leaves zen mode when opening the AI panel, so it is actually visible', () => {
		useLayoutStore.setState({ zen: true, aiOpen: true });
		useLayoutStore.getState().toggleAi(true);
		expect(useLayoutStore.getState()).toMatchObject({ zen: false, aiOpen: true });
	});

	it('shows the hidden panel on a plain toggle in zen, and closes it otherwise', () => {
		useLayoutStore.setState({ zen: true, aiOpen: true });
		useLayoutStore.getState().toggleAi();
		expect(useLayoutStore.getState()).toMatchObject({ zen: false, aiOpen: true });
		useLayoutStore.getState().toggleAi();
		expect(useLayoutStore.getState().aiOpen).toBe(false);
	});

	it('closing keeps zen as it is', () => {
		useLayoutStore.setState({ zen: true, aiOpen: true });
		useLayoutStore.getState().toggleAi(false);
		expect(useLayoutStore.getState()).toMatchObject({ zen: true, aiOpen: false });
	});
});

const wide = { ...LAYOUT_DEFAULTS, sideWidth: 600, aiWidth: 900 };

describe('fitWidths', () => {
	it('leaves panes alone when they fit', () => {
		expect(fitWidths(wide, 2560)).toEqual({});
	});

	it('shrinks the AI pane first, then the side bar, to keep the editor usable', () => {
		const fit = fitWidths(wide, 1366);
		const side = fit.sideWidth ?? wide.sideWidth;
		const ai = fit.aiWidth ?? wide.aiWidth;
		expect(1366 - side - ai - 80).toBe(MIN_EDITOR_WIDTH);
		expect(fit.sideWidth).toBeUndefined();
		expect(ai).toBe(366);
	});

	it('caps the dragged pane instead of pushing the other one', () => {
		const fit = fitWidths({ ...wide, sideWidth: 640, aiWidth: 400 }, 1200, 'side');
		expect(fit).toEqual({ sideWidth: 400 });
	});

	it('never goes below the pane minimums', () => {
		expect(fitWidths(wide, 400)).toEqual({ sideWidth: 180, aiWidth: 280 });
	});

	it('ignores hidden panes and zen', () => {
		expect(fitWidths({ ...wide, aiOpen: false }, 1100)).toEqual({});
		expect(fitWidths({ ...wide, zen: true }, 400)).toEqual({});
	});
});

describe('zen mode', () => {
	beforeEach(() => useLayoutStore.setState({ ...LAYOUT_DEFAULTS, zen: true }));

	it('reveals the side bar instead of hiding it invisibly', () => {
		useLayoutStore.getState().toggleSide();
		expect(useLayoutStore.getState()).toMatchObject({ zen: false, sideOpen: true });
	});

	it('reveals the panel on the requested tab', () => {
		useLayoutStore.getState().togglePanel('problems');
		expect(useLayoutStore.getState()).toMatchObject({
			zen: false,
			panelOpen: true,
			panelTab: 'problems',
		});
	});

	it('leaves zen when the panel is shown or maximized', () => {
		useLayoutStore.getState().showPanel('terminal');
		expect(useLayoutStore.getState().zen).toBe(false);
		useLayoutStore.setState({ zen: true });
		useLayoutStore.getState().toggleMaximizePanel();
		expect(useLayoutStore.getState().zen).toBe(false);
	});

	it('reveals the AI pane, but closing it keeps zen', () => {
		useLayoutStore.getState().toggleAi(false);
		expect(useLayoutStore.getState()).toMatchObject({ zen: true, aiOpen: false });
		useLayoutStore.getState().toggleAi();
		expect(useLayoutStore.getState()).toMatchObject({ zen: false, aiOpen: true });
	});
});
