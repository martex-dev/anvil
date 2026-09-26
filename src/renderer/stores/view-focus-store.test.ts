import { beforeEach, describe, expect, it } from 'vitest';

import { useViewFocus } from './view-focus-store';

beforeEach(() => {
	useViewFocus.setState({ pending: null, tick: 0 });
});

describe('useViewFocus', () => {
	it('lets only the requested view take focus, once', () => {
		useViewFocus.getState().request('snippets');
		expect(useViewFocus.getState().consume('explorer')).toBe(false);
		expect(useViewFocus.getState().consume('snippets')).toBe(true);
		expect(useViewFocus.getState().consume('snippets')).toBe(false);
	});

	it('bumps the tick on every request so a mounted view re-focuses', () => {
		const { request } = useViewFocus.getState();
		request('explorer');
		request('explorer');
		expect(useViewFocus.getState().tick).toBe(2);
		expect(useViewFocus.getState().pending).toBe('explorer');
	});

	it('replaces an unconsumed request with the newest one', () => {
		useViewFocus.getState().request('explorer');
		useViewFocus.getState().request('search');
		expect(useViewFocus.getState().consume('explorer')).toBe(false);
		expect(useViewFocus.getState().consume('search')).toBe(true);
	});
});
