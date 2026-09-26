/**
 * Theme metadata. The colors live only in themes.css, one `[data-theme='<id>']` block per entry;
 * tests/themes.test.ts keeps the two in sync.
 */

export interface ThemeMeta {
	id: string;
	name: string;
	kind: 'dark' | 'light';
	/** One line, e.g. 'Neon cyan on deep space glass'. */
	description: string;
}

export const THEMES: readonly ThemeMeta[] = [
	{
		id: 'cyber',
		name: 'Cyber Glass',
		kind: 'dark',
		description: 'Neon cyan and violet on deep space glass',
	},
	{
		id: 'synthwave',
		name: "Synthwave '84",
		kind: 'dark',
		description: 'Hot pink and orange neon over a purple night sky',
	},
	{
		id: 'tokyo',
		name: 'Tokyo Night',
		kind: 'dark',
		description: 'Midnight indigo with soft city-light blues and purples',
	},
	{
		id: 'dracula',
		name: 'Dracula',
		kind: 'dark',
		description: 'Classic purple-grey with pink, green and cyan',
	},
	{
		id: 'catppuccin',
		name: 'Catppuccin Mocha',
		kind: 'dark',
		description: 'Soothing pastels on a warm dark base',
	},
	{
		id: 'nord',
		name: 'Nord',
		kind: 'dark',
		description: 'Arctic slate with frost blues and muted aurora',
	},
	{
		id: 'gruvbox',
		name: 'Gruvbox Dark',
		kind: 'dark',
		description: 'Warm retro groove in earthy reds, yellows and aquas',
	},
	{
		id: 'rosepine',
		name: 'Rosé Pine',
		kind: 'dark',
		description: 'Muted pine and foam with rose and gold',
	},
	{
		id: 'onedark',
		name: 'One Dark Pro',
		kind: 'dark',
		description: "Atom's balanced slate with red, green, blue and purple",
	},
	{
		id: 'monokai',
		name: 'Monokai Pro',
		kind: 'dark',
		description: 'Charcoal with signature pink, yellow, green and blue',
	},
	{
		id: 'solarized',
		name: 'Solarized Dark',
		kind: 'dark',
		description: 'Precise blue-green base with balanced accents',
	},
	{
		id: 'matrix',
		name: 'Phosphor',
		kind: 'dark',
		description: 'Green-phosphor CRT glow on near-black',
	},
	{
		id: 'amber',
		name: 'Terminal Amber',
		kind: 'dark',
		description: 'Bloomberg-style amber monochrome on black',
	},
	{
		id: 'abyss',
		name: 'Abyss',
		kind: 'dark',
		description: 'Deep ocean navy lit by teal and electric blue',
	},
	{
		id: 'paper',
		name: 'Paper Light',
		kind: 'light',
		description: 'Clean white glass with a crisp blue accent',
	},
	{
		id: 'latte',
		name: 'Catppuccin Latte',
		kind: 'light',
		description: 'Pastel ink on soft porcelain',
	},
];

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME = 'cyber';

const BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

/** Looks up a theme, falling back to the default so a stale stored id never breaks the UI. */
export function themeById(id: string): ThemeMeta {
	const theme = BY_ID.get(id) ?? BY_ID.get(DEFAULT_THEME);
	if (!theme) throw new Error(`Default theme '${DEFAULT_THEME}' is missing from THEMES`);
	return theme;
}
