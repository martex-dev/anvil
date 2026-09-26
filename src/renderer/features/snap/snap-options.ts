import { z } from 'zod';

import { rlog } from '../../lib/log';
import { BACKGROUNDS } from './backgrounds';

const KEY = 'anvil.snap.options';
export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;

const backgroundIds = BACKGROUNDS.map((b) => b.id) as [
	(typeof BACKGROUNDS)[number]['id'],
	...(typeof BACKGROUNDS)[number]['id'][],
];

/** Each field falls back on its own, so one stale value doesn't reset every other choice. */
const OptionsSchema = z.object({
	background: z.enum(backgroundIds).catch('deep-space'),
	padding: z.enum(['s', 'm', 'l']).catch('m'),
	chrome: z.enum(['mac', 'title', 'none']).catch('mac'),
	lineNumbers: z.boolean().catch(false),
	shadow: z.boolean().catch(true),
	glow: z.boolean().catch(true),
	watermark: z.boolean().catch(true),
	/** null follows the editor font size. */
	fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).nullable().catch(null),
});

export type SnapOptions = z.infer<typeof OptionsSchema>;

export function loadSnapOptions(): SnapOptions {
	let raw: unknown = {};
	try {
		raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
	} catch (error) {
		rlog.warn('snap', 'Could not read saved options', error);
	}
	return OptionsSchema.parse(typeof raw === 'object' && raw !== null ? raw : {});
}

export function saveSnapOptions(options: SnapOptions): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(options));
	} catch (error) {
		rlog.warn('snap', 'Could not save options', error);
	}
}
