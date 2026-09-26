import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import { readRecentCommands } from './recent';
import { pickCommand } from './run';

describe('pickCommand', () => {
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v),
		});
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('records the command as recently used and runs it after the picker closes', () => {
		const run = vi.fn();
		pickCommand({ id: 'view.x', title: 'X', category: 'View', run });
		expect(readRecentCommands()).toEqual(['view.x']);
		expect(run).not.toHaveBeenCalled();
		vi.runAllTimers();
		expect(run).toHaveBeenCalledOnce();
	});
});
