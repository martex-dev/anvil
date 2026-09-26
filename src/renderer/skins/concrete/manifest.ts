import type { SkinManifest } from '../types';

/**
 * Concrete: a Swiss / brutalist poster that happens to be an IDE. Paper, pure ink, one
 * screaming accent, 3px rules, hard offset shadows, huge numerals and zero radius.
 */
const concrete: SkinManifest = {
	id: 'concrete',
	name: 'Concrete',
	tagline: 'A brutalist poster: paper, ink, 3px rules, hard shadows and huge numerals.',
	order: 2,
	defaultPalette: 'cc-poster',
	palettes: [
		{
			id: 'cc-poster',
			name: 'Poster',
			kind: 'light',
			description: 'Off-white paper, pure black ink and a screaming yellow',
		},
		{
			id: 'cc-riso',
			name: 'Riso',
			kind: 'light',
			description: 'Risograph blue ink with misregistered fluoro-pink on cream',
		},
		{
			id: 'cc-mint',
			name: 'Mint',
			kind: 'light',
			description: 'Mint card stock, black ink and a tomato-red accent',
		},
		{
			id: 'cc-blueprint',
			name: 'Blueprint',
			kind: 'dark',
			description: 'Cyanotype blue paper, white rules and safety orange',
		},
		{
			id: 'cc-night',
			name: 'Night',
			kind: 'dark',
			description: 'Black paper, white ink and a signal-red accent',
		},
	],
	fonts: {
		ui: ['space-grotesk', 'inter-tight'],
		display: "'Archivo Black', 'Space Grotesk', system-ui, sans-serif",
		code: 'space-mono',
	},
	layout: {
		activity: 'right',
		activityLabels: true,
		sidebar: 'right',
		statusBar: 'top',
		gap: 10,
	},
};

export default concrete;
