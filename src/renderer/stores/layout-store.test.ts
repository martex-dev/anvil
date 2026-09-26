import { beforeEach, describe, expect, it } from 'vitest';

import { LAYOUT_DEFAULTS, useLayoutStore } from './layout-store';

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
