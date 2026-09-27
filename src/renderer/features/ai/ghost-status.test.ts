import { describe, expect, it } from 'vitest';

import { beginGhostRequest, useGhostStatus } from './ghost-status';

describe('ghost busy status', () => {
	it('stays busy while a newer request is in flight after an older one settles', () => {
		const cancelled = beginGhostRequest();
		const newer = beginGhostRequest();

		cancelled();
		expect(useGhostStatus.getState().busy).toBe(true);

		newer();
		expect(useGhostStatus.getState().busy).toBe(false);
	});

	it('counts a request once even if it settles twice', () => {
		const a = beginGhostRequest();
		const b = beginGhostRequest();
		a();
		a();
		expect(useGhostStatus.getState().busy).toBe(true);
		b();
		expect(useGhostStatus.getState().busy).toBe(false);
	});
});
