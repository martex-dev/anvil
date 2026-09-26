import { z } from 'zod';

/** Named accent presets; 'theme' follows the theme's own accent, 'custom' uses `customAccent`. */
export const ACCENTS = ['cyan', 'magenta', 'lime', 'violet', 'amber'] as const;
export type Accent = (typeof ACCENTS)[number];
export const ACCENT_MODES = ['theme', ...ACCENTS, 'custom'] as const;
export type AccentMode = (typeof ACCENT_MODES)[number];

/** Coding fonts bundled with Anvil (loaded on first use). */
export const EDITOR_FONTS = [
	{ id: 'jetbrains', name: 'JetBrains Mono', family: 'JetBrains Mono', ligatures: true },
	{ id: 'fira', name: 'Fira Code', family: 'Fira Code', ligatures: true },
	{ id: 'cascadia', name: 'Cascadia Code', family: 'Cascadia Code', ligatures: true },
	{ id: 'geist', name: 'Geist Mono', family: 'Geist Mono', ligatures: false },
	{ id: 'monaspace', name: 'Monaspace Neon', family: 'Monaspace Neon', ligatures: true },
	{ id: 'maple', name: 'Maple Mono', family: 'Maple Mono', ligatures: true },
	{ id: 'victor', name: 'Victor Mono', family: 'Victor Mono', ligatures: true },
	{ id: 'iosevka', name: 'Iosevka', family: 'Iosevka', ligatures: true },
	{ id: 'plex', name: 'IBM Plex Mono', family: 'IBM Plex Mono', ligatures: false },
] as const;
export type EditorFontId = (typeof EDITOR_FONTS)[number]['id'];
const FONT_IDS = EDITOR_FONTS.map((f) => f.id) as [EditorFontId, ...EditorFontId[]];

export function editorFontFamily(id: string): string {
	const font = EDITOR_FONTS.find((f) => f.id === id) ?? EDITOR_FONTS[0];
	return `'${font.family}', 'JetBrains Mono', ui-monospace, monospace`;
}

export const SettingsSchema = z.object({
	/** UI text size; the editor has its own. */
	uiFontSize: z.number().int().min(11).max(15).default(13),
	editorFontSize: z.number().int().min(10).max(24).default(14),
	editorFont: z.enum(FONT_IDS).default('jetbrains'),
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
	/** Theme id from the renderer's theme list; unknown ids fall back to the default theme. */
	theme: z.string().min(1).max(32).default('cyber'),
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
	/** "Author, time • message" after the line the cursor is on (Toggle Inline Blame). */
	inlineBlame: z.boolean().default(true),
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

type SettingsShape = typeof SettingsSchema.shape;

/**
 * A partial settings update. Not `SettingsSchema.partial()`: in zod 4 an optional field that
 * wraps a default still fills the default in, so a one-key patch would come back with every
 * other key set to its default and overwrite the stored values.
 */
export const SettingsPatchSchema = z.object(
	Object.fromEntries(
		Object.entries(SettingsSchema.shape).map(([key, field]) => [
			key,
			field.unwrap().optional(),
		]),
	) as { [K in keyof SettingsShape]: z.ZodOptional<ReturnType<SettingsShape[K]['unwrap']>> },
);
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

/** Merges a patch over the current settings; keys sent as `undefined` keep their current value. */
export function applySettingsPatch(current: Settings, patch: SettingsPatch): Settings {
	const defined = Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	);
	return { ...current, ...defined };
}

/**
 * Reads stored settings field by field: a value that no longer validates (hand edit, a font
 * removed in a later release) falls back to its own default instead of resetting every
 * preference, and unknown keys are dropped. `invalid` names the fields that were replaced.
 */
export function parseSettings(raw: unknown): { settings: Settings; invalid: string[] } {
	const source: Record<string, unknown> =
		raw && typeof raw === 'object' && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	const invalid: string[] = [];
	const picked: Record<string, unknown> = {};
	for (const [key, field] of Object.entries(SettingsSchema.shape)) {
		if (!(key in source)) continue;
		if (field.safeParse(source[key]).success) picked[key] = source[key];
		else invalid.push(key);
	}
	if (raw !== undefined && source !== raw) invalid.push('<settings>');
	return { settings: SettingsSchema.parse(picked), invalid };
}
