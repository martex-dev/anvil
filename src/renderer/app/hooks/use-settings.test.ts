import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@shared/settings';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));

import { SETTINGS_KEY, watchSetting } from './use-settings';

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
