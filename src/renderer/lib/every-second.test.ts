import { afterEach, describe, expect, it, vi } from 'vitest';

import { everySecond } from './every-second';

describe('everySecond', () => {
	afterEach(() => vi.useRealTimers());

	it('ticks on second boundaries and stops when asked', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T09:30:00.700Z'));
		const ticks: number[] = [];
		const stop = everySecond((d) => ticks.push(d.getTime() % 1000));
		vi.advanceTimersByTime(299);
		expect(ticks).toEqual([]);
		vi.advanceTimersByTime(1);
		vi.advanceTimersByTime(2000);
		expect(ticks).toEqual([0, 0, 0]);
		stop();
		vi.advanceTimersByTime(5000);
		expect(ticks).toHaveLength(3);
	});
});
