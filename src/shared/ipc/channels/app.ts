import { z } from 'zod';

import { isSafeExternalUrl } from '../../external-url';
import { defineChannels } from '../define';

export const AppMetricsSchema = z.object({
	/** Sum over Anvil's own processes (main, renderer, GPU, utility). */
	memoryMb: z.number(),
	cpuPercent: z.number(),
	processes: z.number().int(),
});
export type AppMetrics = z.infer<typeof AppMetricsSchema>;

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb');

/** The native window background, taken from the active palette's --bg-0. */
export const WindowChromeSchema = z.object({ background: HexColorSchema });
export type WindowChrome = z.infer<typeof WindowChromeSchema>;

/** A main-process module that threw while starting; its panels will not work this session. */
export const FeatureFailureSchema = z.object({ id: z.string(), message: z.string() });
export type FeatureFailure = z.infer<typeof FeatureFailureSchema>;

/**
 * A folder or file Anvil was launched with (`Anvil.exe C:\proj`, "Open with Anvil", a second
 * start). `folder` null means the current one; `file` is relative to the folder it opens in.
 */
export const LaunchRequestSchema = z.object({
	folder: z.string().nullable(),
	file: z.string().nullable(),
});
export type LaunchRequest = z.infer<typeof LaunchRequestSchema>;

export const appChannels = defineChannels({
	/** The file this process was launched with, once (the page asks after it loads). */
	'app:takeLaunchRequest': { input: z.void(), output: LaunchRequestSchema.nullable() },
	'app:getVersion': { input: z.void(), output: z.string() },
	'app:getPlatform': { input: z.void(), output: z.string() },
	'app:reloadWindow': { input: z.void(), output: z.void() },
	'app:toggleFullScreen': { input: z.void(), output: z.boolean() },
	'app:toggleDevTools': { input: z.void(), output: z.void() },
	'app:metrics': { input: z.void(), output: AppMetricsSchema },
	/** Modules that failed to start, so the shell can say which integration is down and why. */
	'app:featureErrors': { input: z.void(), output: z.array(FeatureFailureSchema) },
	/** Recolors the native window background to match the palette (and remembers it for launch). */
	'app:setChrome': { input: WindowChromeSchema, output: z.void() },
	/** Opens Anvil's log folder in Explorer. */
	'app:openLogs': { input: z.void(), output: z.void() },
	/** https anywhere, or http to localhost (notebook and dashboard servers); see external-url.ts. */
	'app:openExternal': {
		input: z
			.url()
			.refine(isSafeExternalUrl, 'Only https links, or http links to this computer'),
		output: z.void(),
	},
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

export const appEvents = {
	/** A second start asked for a folder or file; the page confirms unsaved work, then opens it. */
	'app:launchRequest': LaunchRequestSchema,
};
