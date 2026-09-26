import { z } from 'zod';

import { defineChannels } from '../define';

export const UpdateStatusSchema = z.discriminatedUnion('state', [
	/** Development builds (and e2e) never update themselves. */
	z.object({ state: z.literal('disabled'), reason: z.string() }),
	z.object({ state: z.literal('idle'), lastChecked: z.number().nullable() }),
	z.object({ state: z.literal('checking') }),
	z.object({ state: z.literal('downloading'), version: z.string(), percent: z.number() }),
	/** Downloaded; installs on restart (or on the next quit). */
	z.object({ state: z.literal('ready'), version: z.string() }),
	z.object({
		state: z.literal('error'),
		message: z.string(),
		lastChecked: z.number().nullable(),
	}),
]);
export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;

export const updateChannels = defineChannels({
	'update:status': { input: z.void(), output: UpdateStatusSchema },
	'update:check': { input: z.void(), output: UpdateStatusSchema },
	/** Quits and installs a downloaded update; no-op unless ready. */
	'update:install': { input: z.void(), output: z.void() },
});

export const updateEvents = {
	'update:changed': UpdateStatusSchema,
};
