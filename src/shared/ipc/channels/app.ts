import { z } from 'zod';

import { defineChannels } from '../define';

export const AppMetricsSchema = z.object({
	/** Sum over Anvil's own processes (main, renderer, GPU, utility). */
	memoryMb: z.number(),
	cpuPercent: z.number(),
	processes: z.number().int(),
});
export type AppMetrics = z.infer<typeof AppMetricsSchema>;

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb');

/** Colors of the native caption buttons and window background, taken from the active theme. */
export const WindowChromeSchema = z.object({ background: HexColorSchema, symbol: HexColorSchema });
export type WindowChrome = z.infer<typeof WindowChromeSchema>;

/** A main-process module that threw while starting; its panels will not work this session. */
export const FeatureFailureSchema = z.object({ id: z.string(), message: z.string() });
export type FeatureFailure = z.infer<typeof FeatureFailureSchema>;

export const appChannels = defineChannels({
	'app:getVersion': { input: z.void(), output: z.string() },
	'app:getPlatform': { input: z.void(), output: z.string() },
	'app:reloadWindow': { input: z.void(), output: z.void() },
	'app:toggleFullScreen': { input: z.void(), output: z.boolean() },
	'app:toggleDevTools': { input: z.void(), output: z.void() },
	'app:metrics': { input: z.void(), output: AppMetricsSchema },
	/** Modules that failed to start, so the shell can say which integration is down and why. */
	'app:featureErrors': { input: z.void(), output: z.array(FeatureFailureSchema) },
	/** Recolors the native title bar buttons to match the theme (and remembers it for launch). */
	'app:setChrome': { input: WindowChromeSchema, output: z.void() },
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
