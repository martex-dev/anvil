import { z } from 'zod';

import { defineChannels } from '../define';

export const WindowStateSchema = z.object({
	maximized: z.boolean(),
	focused: z.boolean(),
	fullScreen: z.boolean(),
});
export type WindowState = z.infer<typeof WindowStateSchema>;

/**
 * Window buttons are drawn by the skin (a Win95 [X], glossy orbs, a text [_]), so the
 * renderer drives minimize / maximize / close itself.
 */
export const windowChannels = defineChannels({
	'window:state': { input: z.void(), output: WindowStateSchema },
	'window:minimize': { input: z.void(), output: z.void() },
	'window:toggleMaximize': { input: z.void(), output: WindowStateSchema },
	'window:close': { input: z.void(), output: z.void() },
});

export const windowEvents = {
	'window:changed': WindowStateSchema,
};
