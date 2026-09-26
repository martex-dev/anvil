import { z } from 'zod';

import { EDITOR_FONT_IDS } from './fonts';

/** Named accent presets; 'theme' follows the theme's own accent, 'custom' uses `customAccent`. */
export const ACCENTS = ['cyan', 'magenta', 'lime', 'violet', 'amber'] as const;
export type Accent = (typeof ACCENTS)[number];
export const ACCENT_MODES = ['theme', ...ACCENTS, 'custom'] as const;
export type AccentMode = (typeof ACCENT_MODES)[number];

export { EDITOR_FONTS, editorFontFamily, type EditorFontId } from './fonts';

export const DENSITIES = ['compact', 'cozy', 'roomy'] as const;
export const FX_LEVELS = ['full', 'subtle', 'off'] as const;

/** What the user picked inside one skin: its color variant and UI font. */
const SkinPrefsSchema = z.object({
	palette: z.string().min(1).max(32).optional(),
	uiFont: z.string().min(1).max(32).optional(),
});
export type SkinPrefs = z.infer<typeof SkinPrefsSchema>;

export const SettingsSchema = z.object({
	/** UI text size; the editor has its own. */
	uiFontSize: z.number().int().min(11).max(15).default(13),
	editorFontSize: z.number().int().min(10).max(24).default(14),
	/** A bundled code font, or 'skin' for the skin's own. */
	editorFont: z.enum(['skin', ...EDITOR_FONT_IDS]).default('skin'),
	/** Line height as a multiple of the font size. */
	editorLineHeight: z.number().min(1.2).max(2.2).default(1.65),
	editorLigatures: z.boolean().default(true),
	tabSize: z.number().int().min(1).max(8).default(4),
	wordWrap: z.boolean().default(false),
	minimap: z.boolean().default(true),
	formatOnSave: z.boolean().default(false),
	trimTrailingWhitespace: z.boolean().default(false),
	insertFinalNewline: z.boolean().default(false),
	/** Save a snapshot on every save so files can be rolled back from the History view. */
	localHistory: z.boolean().default(true),
	/**
	 * The skin: a whole look (layout, chrome, fonts, icons). Unknown ids fall back to the
	 * default skin.
	 */
	skin: z.string().min(1).max(32).default('cyber'),
	/** Cyber Glass palette (kept separate so pre-skin settings carry over). */
	theme: z.string().min(1).max(32).default('cyber'),
	/** Per-skin choices, keyed by skin id. */
	skinPrefs: z.record(z.string().max(32), SkinPrefsSchema).default({}),
	/** Spacing scale for the whole UI. */
	density: z.enum(DENSITIES).default('cozy'),
	/** How much a skin animates and decorates: scanlines, glows, sweeps, noise. */
	fx: z.enum(FX_LEVELS).default('full'),
	/** Which side the side bar sits on; 'skin' follows the skin's layout. */
	sidebarSide: z.enum(['skin', 'left', 'right']).default('skin'),
	accent: z.enum(ACCENT_MODES).default('theme'),
	customAccent: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.default('#22e5ff'),
	/**
	 * Glass is blur + translucency on the chrome. 'off' makes every surface solid, which is
	 * cheaper on integrated GPUs and battery.
	 */
	glass: z.enum(['full', 'subtle', 'off']).default('full'),
	/** The animated background grid and glows behind the glass. */
	ambient: z.boolean().default(true),
	reduceMotion: z.boolean().default(false),
	cursorStyle: z.enum(['line', 'block', 'underline']).default('line'),
	/** Accent-colored glow on the cursor. */
	neonCursor: z.boolean().default(true),
	/** Alternating tints on indentation levels. */
	rainbowIndent: z.boolean().default(true),
	/** Errors and warnings written at the end of their line. */
	errorLens: z.boolean().default(true),
	/** Colored TODO / FIXME / HACK / NOTE markers in comments. */
	todoHighlight: z.boolean().default(true),
	/** Inline swatches (and a picker) for #hex, rgb() and hsl() colors in any file. */
	colorSwatches: z.boolean().default(true),
	/** Tabs tinted by file type, with an error dot when the file has problems. */
	tabTint: z.boolean().default(true),
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

/**
 * A partial update. Built without the defaults on purpose: zod's `.partial()` keeps them, so a
 * patch like `{ fx: 'off' }` would parse into a full default object and reset every other setting.
 */
export const SettingsPatchSchema = z.object(
	Object.fromEntries(
		Object.entries(SettingsSchema.shape).map(([key, field]) => [
			key,
			(field instanceof z.ZodDefault ? field.unwrap() : field).optional(),
		]),
	),
) as unknown as z.ZodType<Partial<Settings>, Partial<Settings>>;
