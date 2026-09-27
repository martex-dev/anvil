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
	/** How many files have unsaved edits; while it's above 0, closing asks the page first. */
	'window:setUnsaved': { input: z.number().int().min(0), output: z.void() },
	/**
	 * After window:closeRequested, once unsaved files are saved or deliberately discarded:
	 * finish the close or reload.
	 */
	'window:proceedUnload': { input: z.void(), output: z.void() },
});

export const windowEvents = {
	'window:changed': WindowStateSchema,
	/** A close or reload was held back because of unsaved files; the page asks what to do. */
	'window:closeRequested': z.object({ intent: z.enum(['close', 'reload']) }),
};
