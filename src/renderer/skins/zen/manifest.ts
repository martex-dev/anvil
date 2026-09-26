import type { SkinManifest } from '../types';

/**
 * Zen Paper: a calm, editorial writing app. Serif type on warm paper, hairline rules instead of
 * boxes, code set in a centered column, and chrome that stays out of the way until you reach
 * for it.
 */
const zen: SkinManifest = {
	id: 'zen',
	name: 'Zen Paper',
	tagline: 'Serif type on warm paper, hairline rules, chrome that recedes until you need it.',
	order: 6,
	defaultPalette: 'zn-paper',
	palettes: [
		{
			id: 'zn-paper',
			name: 'Paper',
			kind: 'light',
			description: 'Charcoal ink and a vermilion seal on warm cream paper',
		},
		{
			id: 'zn-sepia',
			name: 'Sepia',
			kind: 'light',
			description: 'Walnut ink on an aged, sun-browned page',
		},
		{
			id: 'zn-sakura',
			name: 'Sakura',
			kind: 'light',
			description: 'Plum ink on pale pink washi',
		},
		{
			id: 'zn-ink',
			name: 'Night Ink',
			kind: 'dark',
			description: 'Warm ivory ink and gold leaf on indigo-black night paper',
		},
		{
			id: 'zn-forest',
			name: 'Forest',
			kind: 'dark',
			description: 'Cream ink and persimmon on deep moss-green paper',
		},
	],
	fonts: {
		ui: ['newsreader', 'fraunces'],
		display: "'Instrument Serif', 'Newsreader', Georgia, serif",
		code: 'plex',
	},
	layout: {
		activity: 'rail',
		activityLabels: true,
		sidebar: 'drawer',
		statusBar: 'bottom',
		gap: 16,
		editorColumn: 820,
		autoHideChrome: true,
	},
};

export default zen;
