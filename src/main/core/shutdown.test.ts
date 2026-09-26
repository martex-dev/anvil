import { describe, expect, it, vi } from 'vitest';

import { shutdownWithin } from './shutdown';

describe('shutdownWithin', () => {
	it('runs every step and the final step even when one step fails', async () => {
		const order: string[] = [];
		const logError = vi.fn();
		await shutdownWithin({
			steps: [
				() => Promise.reject(new Error('watcher')),
				() => {
					order.push('b');
				},
			],
			finally: () => order.push('flush'),
			timeoutMs: 1000,
			logError,
		});
		expect(order).toEqual(['b', 'flush']);
		expect(logError).toHaveBeenCalledWith('[main] error during shutdown', expect.any(Error));
	});

	it('gives up on a hung step after the deadline and still flushes', async () => {
		vi.useFakeTimers();
		try {
			const flush = vi.fn();
			const logError = vi.fn();
			const done = shutdownWithin({
				steps: [() => new Promise<void>(() => undefined)],
				finally: flush,
				timeoutMs: 5000,
				logError,
			});
			await vi.advanceTimersByTimeAsync(5000);
			await done;
			expect(flush).toHaveBeenCalledOnce();
			expect(logError).toHaveBeenCalledWith(expect.stringContaining('quitting anyway'));
		} finally {
			vi.useRealTimers();
		}
	});

	it('logs a failing final step instead of throwing', async () => {
		const logError = vi.fn();
		await expect(
			shutdownWithin({
				steps: [],
				finally: () => {
					throw new Error('disk');
				},
				timeoutMs: 1000,
				logError,
			}),
		).resolves.toBeUndefined();
		expect(logError).toHaveBeenCalledWith(
			'[main] final shutdown step failed',
			expect.any(Error),
		);
	});
});
