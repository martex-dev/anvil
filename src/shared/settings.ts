import { z } from 'zod';

export const ACCENTS = ['cyan', 'magenta', 'lime', 'violet', 'amber'] as const;
export type Accent = (typeof ACCENTS)[number];

export const SettingsSchema = z.object({
	/** UI text size; the editor has its own. */
	uiFontSize: z.number().int().min(11).max(15).default(13),
	editorFontSize: z.number().int().min(10).max(24).default(14),
	editorLigatures: z.boolean().default(true),
	tabSize: z.number().int().min(1).max(8).default(4),
	wordWrap: z.boolean().default(false),
	minimap: z.boolean().default(true),
	formatOnSave: z.boolean().default(false),
	/** Save a snapshot on every save so files can be rolled back from the History view. */
	localHistory: z.boolean().default(true),
	accent: z.enum(ACCENTS).default('cyan'),
	/**
	 * Glass is blur + translucency on the chrome. 'off' makes every surface solid, which is
	 * cheaper on integrated GPUs and battery.
	 */
	glass: z.enum(['full', 'subtle', 'off']).default('full'),
	/** The animated background grid and glows behind the glass. */
	ambient: z.boolean().default(true),
	reduceMotion: z.boolean().default(false),
	/** Blur values in .env files and flag keys/seed phrases in code. */
	secretShield: z.boolean().default(true),
	/** Copilot-style gray suggestions while typing. */
	ghostText: z.boolean().default(true),
	ghostDelayMs: z.number().int().min(100).max(2000).default(350),
	/** Check the releases feed and download updates in the background (installed builds only). */
	autoUpdate: z.boolean().default(true),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
