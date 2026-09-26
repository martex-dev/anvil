import type { SkinManifest } from '../types';

/**
 * Y2K Chrome: the glossy future as imagined in 2000. Liquid-metal title bar, jelly pill buttons
 * with a white highlight band, bubble launcher, candy panes floating over a pastel sunset.
 */
const y2k: SkinManifest = {
	id: 'y2k',
	name: 'Y2K Chrome',
	tagline: 'Liquid chrome, jelly pill buttons and bubble launchers over a pastel sunset.',
	order: 7,
	defaultPalette: 'yk-bubblegum',
	palettes: [
		{
			id: 'yk-bubblegum',
			name: 'Bubblegum',
			kind: 'light',
			description: 'Hot pink jelly and cyan bubbles on a lavender sunset',
		},
		{
			id: 'yk-aqua',
			name: 'Aqua',
			kind: 'light',
			description: 'Lickable blue gel buttons on brushed silver pinstripes',
		},
		{
			id: 'yk-chrome',
			name: 'Liquid Chrome',
			kind: 'light',
			description: 'Polished silver metal with an iridescent violet sheen',
		},
		{
			id: 'yk-midnight',
			name: 'Vapor Midnight',
			kind: 'dark',
			description: 'Purple vaporwave night with pink and cyan neon jelly',
		},
		{
			id: 'yk-lime',
			name: 'Tangerine Lime',
			kind: 'light',
			description: 'Translucent iMac candy in lime and tangerine',
		},
	],
	fonts: {
		ui: ['nunito', 'baloo', 'comfortaa'],
		display: "'Baloo 2', 'Nunito', system-ui, sans-serif",
		code: 'maple',
	},
	layout: {
		activity: 'left',
		activityLabels: false,
		sidebar: 'left',
		statusBar: 'bottom',
		gap: 12,
	},
};

export default y2k;
