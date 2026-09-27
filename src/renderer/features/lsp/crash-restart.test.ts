import { describe, expect, it } from 'vitest';

import { MAX_RESTARTS, RESTART_WINDOW_MS, RestartBudget } from './crash-restart';

describe('RestartBudget', () => {
	it('backs off, gives up after a few crashes, and forgets old ones', () => {
		let now = 0;
		const budget = new RestartBudget(() => now);
		expect(MAX_RESTARTS).toBe(3);
		expect([budget.next(), budget.next(), budget.next()]).toEqual([1_000, 2_000, 4_000]);
		// A fourth crash within the window: stay down, the user restarts by hand.
		now = 60_000;
		expect(budget.next()).toBeNull();
		// Once the early crashes are old enough, automatic restarts resume.
		now = RESTART_WINDOW_MS + 1;
		expect(budget.next()).toBe(1_000);
	});
});
