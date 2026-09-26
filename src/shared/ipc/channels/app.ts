import { z } from 'zod';

import { defineChannels } from '../define';

export const AppMetricsSchema = z.object({
	/** Sum over Anvil's own processes (main, renderer, GPU, utility). */
	memoryMb: z.number(),
	cpuPercent: z.number(),
	processes: z.number().int(),
});
export type AppMetrics = z.infer<typeof AppMetricsSchema>;

export const appChannels = defineChannels({
	'app:getVersion': { input: z.void(), output: z.string() },
	'app:getPlatform': { input: z.void(), output: z.string() },
	'app:reloadWindow': { input: z.void(), output: z.void() },
	'app:toggleFullScreen': { input: z.void(), output: z.boolean() },
	'app:toggleDevTools': { input: z.void(), output: z.void() },
	'app:metrics': { input: z.void(), output: AppMetricsSchema },
	/** Opens Anvil's log folder in Explorer. */
	'app:openLogs': { input: z.void(), output: z.void() },
	'app:openExternal': { input: z.url({ protocol: /^https$/ }), output: z.void() },
	/** Renderer has no file logger; it forwards warnings/errors to main's electron-log. */
	'app:log': {
		input: z.object({
			level: z.enum(['info', 'warn', 'error']),
			scope: z.string().max(64),
			message: z.string().max(4000),
			detail: z.string().max(20_000).optional(),
		}),
		output: z.void(),
	},
});
