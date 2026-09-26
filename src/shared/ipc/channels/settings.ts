import { z } from 'zod';

import { SettingsSchema } from '../../settings';
import { defineChannels } from '../define';

export const settingsChannels = defineChannels({
	'settings:get': { input: z.void(), output: SettingsSchema },
	'settings:update': { input: SettingsSchema.partial(), output: SettingsSchema },
	/** Small UI state that should survive restarts (panel sizes, open views). Opaque JSON. */
	'ui:getState': { input: z.void(), output: z.record(z.string(), z.unknown()) },
	'ui:setState': {
		input: z
			.record(z.string(), z.unknown())
			.refine((v) => JSON.stringify(v).length < 200_000, 'UI state is too large'),
		output: z.void(),
	},
});

export const settingsEvents = {
	'settings:changed': SettingsSchema,
};
