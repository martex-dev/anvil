import type { SkinManifest } from '../types';

/**
 * Holo HUD: a starship's tactical interface. Chamfered panes drawn in luminous lines, corner
 * brackets, hex grids and a targeting ring in deep space, Orbitron readouts with system codes.
 */
const holo: SkinManifest = {
	id: 'holo',
	name: 'Holo HUD',
	tagline: 'A starship tactical display: chamfered holo panes, targeting rings, power meters.',
	order: 5,
	defaultPalette: 'ho-cyan',
	palettes: [
		{
			id: 'ho-cyan',
			name: 'Tactical Cyan',
			kind: 'dark',
			description: 'Cyan holo-lines on a deep navy bridge display',
		},
		{
			id: 'ho-redalert',
			name: 'Red Alert',
			kind: 'dark',
			description: 'Battle stations: crimson readouts on black',
		},
		{
			id: 'ho-gold',
			name: 'Command Gold',
			kind: 'dark',
			description: 'Gold and amber instrumentation on dark bronze',
		},
		{
			id: 'ho-ultraviolet',
			name: 'Ultraviolet',
			kind: 'dark',
			description: 'Violet and magenta sensor light in a nebula',
		},
		{
			id: 'ho-arctic',
			name: 'Arctic Station',
			kind: 'light',
			description: 'White holo-glass traced in teal, for bright bridges',
		},
	],
	fonts: {
		ui: ['rajdhani', 'chakra-petch'],
		display: "'Orbitron', 'Rajdhani', sans-serif",
		code: 'share-tech',
	},
	layout: {
		activity: 'top',
		activityLabels: true,
		sidebar: 'left',
		statusBar: 'bottom',
		gap: 8,
	},
};

export default holo;
