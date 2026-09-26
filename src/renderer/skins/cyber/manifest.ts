import type { SkinManifest } from '../types';

/**
 * Cyber Glass: floating panes of frosted glass over a deep-space background, neon hairline
 * edges and one accent driving focus. The original Anvil look, and the default.
 */
const cyber: SkinManifest = {
	id: 'cyber',
	name: 'Cyber Glass',
	tagline: 'Frosted glass panes, neon hairlines, a drifting grid in deep space.',
	order: 0,
	defaultPalette: 'cyber',
	palettes: [
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
	],
	fonts: {
		ui: ['geist', 'inter-tight', 'space-grotesk'],
		display: "'JetBrains Mono', ui-monospace, monospace",
		code: 'jetbrains',
	},
	layout: {
		activity: 'left',
		activityLabels: false,
		sidebar: 'left',
		statusBar: 'bottom',
		gap: 6,
	},
};

export default cyber;
