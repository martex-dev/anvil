import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, type Settings } from '@shared/settings';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));

import { call } from '../../lib/ipc';
import { SETTINGS_KEY, settingsMutationOptions, watchSetting } from './use-settings';

const callMock = vi.mocked(call);

describe('watchSetting', () => {
	it('fires only when the watched key changes, from any writer', () => {
		const client = new QueryClient();
		client.setQueryData(SETTINGS_KEY, DEFAULT_SETTINGS);
		const seen: boolean[] = [];
		const stop = watchSetting('secretShield', (v) => seen.push(v), client);

		const flip = !DEFAULT_SETTINGS.secretShield;
		client.setQueryData(SETTINGS_KEY, { ...DEFAULT_SETTINGS, secretShield: flip });
		client.setQueryData(SETTINGS_KEY, {
			...DEFAULT_SETTINGS,
			secretShield: flip,
			ghostText: !DEFAULT_SETTINGS.ghostText,
		});
		client.setQueryData(['other'], 1);
		expect(seen).toEqual([flip]);

		stop();
		client.setQueryData(SETTINGS_KEY, DEFAULT_SETTINGS);
		expect(seen).toEqual([flip]);
	});
});

describe('settingsMutationOptions', () => {
	// Main applies patches in order and answers each with the full settings, one tick later.
	let server: Settings;
	const resolvers: (() => void)[] = [];
	beforeEach(() => {
		server = { ...DEFAULT_SETTINGS, editorFontSize: 14 };
		resolvers.length = 0;
		callMock.mockReset();
		callMock.mockImplementation(((_channel: string, patch: Partial<Settings>) => {
			server = { ...server, ...patch };
			const reply = server;
			return new Promise((resolve) => resolvers.push(() => resolve(reply)));
		}) as unknown as typeof call);
	});
	const save = (client: QueryClient, patch: Partial<Settings>): Promise<Settings> =>
		new MutationObserver(client, settingsMutationOptions(client)).mutate(patch);
	const size = (client: QueryClient): number | undefined =>
		client.getQueryData<Settings>(SETTINGS_KEY)?.editorFontSize;

	it('applies each patch at once so quick repeats build on each other', async () => {
		const client = new QueryClient();
		client.setQueryData(SETTINGS_KEY, server);
		const first = save(client, { editorFontSize: (size(client) ?? 0) + 1 });
		await vi.waitFor(() => expect(size(client)).toBe(15));
		const second = save(client, { editorFontSize: (size(client) ?? 0) + 1 });
		await vi.waitFor(() => expect(size(client)).toBe(16));
		resolvers.shift()?.();
		await first;
		// The older response must not drag the value back while the newer save is pending.
		expect(size(client)).toBe(16);
		resolvers.shift()?.();
		await second;
		expect(size(client)).toBe(16);
	});

	it('rolls back when the save fails', async () => {
		const client = new QueryClient();
		client.setQueryData(SETTINGS_KEY, server);
		client.setQueryDefaults(SETTINGS_KEY, { queryFn: () => server });
		callMock.mockRejectedValueOnce(new Error('disk full'));
		await expect(save(client, { editorFontSize: 20 })).rejects.toThrow('disk full');
		expect(size(client)).toBe(14);
	});
});
