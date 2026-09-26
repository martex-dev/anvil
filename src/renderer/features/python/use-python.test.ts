import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PickItem } from '../../ui/QuickPick';

const call = vi.fn();
const quickPick = vi.fn();
const toastError = vi.fn();
const rlogError = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
vi.mock('../../lib/log', () => ({ rlog: { error: rlogError, warn: vi.fn(), info: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({
	toast: { error: toastError, info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../ui/QuickPick', () => ({ quickPick }));
vi.mock('../terminal/TerminalPane', () => ({ PRESETS_KEY: ['terminal', 'presets'] }));

const { queryClient } = await import('../../lib/query-client');
const { pickPythonEnv } = await import('./use-python');

beforeEach(() => {
	call.mockReset();
	quickPick.mockReset().mockResolvedValue(null);
	toastError.mockReset();
	rlogError.mockReset();
	queryClient.setQueryData(['workspace'], { root: 'C:/proj' });
});

describe('pickPythonEnv', () => {
	it('still offers Automatic and reports why when discovery fails', async () => {
		call.mockRejectedValue(new Error('py launcher crashed'));
		await pickPythonEnv();
		const options = quickPick.mock.calls[0]?.[0] as { items: Promise<PickItem[]> };
		const items = await options.items;
		expect(items.map((i) => i.id)).toEqual(['__auto__']);
		expect(toastError).toHaveBeenCalledWith(
			'Could not list interpreters',
			'py launcher crashed',
		);
		expect(rlogError).toHaveBeenCalled();
	});
});
