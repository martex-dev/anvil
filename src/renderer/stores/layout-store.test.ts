import { describe, expect, it } from 'vitest';

import { fitWidths, LAYOUT_DEFAULTS, MIN_EDITOR_WIDTH } from './layout-store';

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
