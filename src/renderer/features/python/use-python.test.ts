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

describe('applyPythonChanged', () => {
	const env = {
		path: 'C:/a/.venv/Scripts/python.exe',
		label: '.venv',
		kind: 'venv' as const,
		version: '3.12.4',
		local: true,
	};

	it('stores the interpreter under the folder main resolved it for', async () => {
		const { QueryClient } = await import('@tanstack/react-query');
		const { applyPythonChanged, pythonKeys } = await import('./use-python');
		const client = new QueryClient();
		client.setQueryData(pythonKeys.selected('C:/b'), null);
		applyPythonChanged(client, { root: 'C:/a', env });
		expect(client.getQueryData(pythonKeys.selected('C:/a'))).toEqual(env);
		expect(client.getQueryData(pythonKeys.selected('C:/b'))).toBeNull();
	});

	it("refreshes the folder's python queries except the selection itself", async () => {
		const { QueryClient } = await import('@tanstack/react-query');
		const { applyPythonChanged, pythonKeys } = await import('./use-python');
		const client = new QueryClient();
		client.setQueryData(pythonKeys.packages('C:/a', env.path), []);
		client.setQueryData(pythonKeys.packages('C:/b', env.path), []);
		client.setQueryData(['terminal', 'presets'], []);
		applyPythonChanged(client, { root: 'C:/a', env });
		const state = (key: readonly unknown[]): boolean | undefined =>
			client.getQueryState(key)?.isInvalidated;
		expect(state(pythonKeys.selected('C:/a'))).toBe(false);
		expect(state(pythonKeys.packages('C:/a', env.path))).toBe(true);
		expect(state(pythonKeys.packages('C:/b', env.path))).toBe(false);
		expect(state(['terminal', 'presets'])).toBe(true);
	});
});
