import { describe, expect, it, vi } from 'vitest';

import { fanOut } from './fan-out';

describe('fanOut', () => {
	it('keeps delivering to later subscribers when one throws', () => {
		const boom = new Error('panel bug');
		const first = vi.fn(() => {
			throw boom;
		});
		const second = vi.fn();
		const report = vi.fn();
		fanOut([first, second], { dirs: [] }, report);
		expect(second).toHaveBeenCalledWith({ dirs: [] });
		expect(report).toHaveBeenCalledWith(boom);
	});

	it('re-raises errors in a microtask by default', () => {
		const boom = new Error('late');
		const queued: Array<() => void> = [];
		const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((cb) => {
			queued.push(cb);
		});
		try {
			const after = vi.fn();
			const throwing = (): void => {
				throw boom;
			};
			fanOut([throwing, after], null);
			expect(after).toHaveBeenCalled();
			expect(queued).toHaveLength(1);
			expect(() => queued[0]?.()).toThrow(boom);
		} finally {
			spy.mockRestore();
		}
	});
});
