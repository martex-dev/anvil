import type { SkinManifest } from '../types';

/**
 * Cockpit: a trading-desk workstation. Black tiles on a grid, amber data, inverted pane
 * headers, a command line under the title and a tape along the bottom. Built for density:
 * everything is small caps, 1px rules and numbers you can scan.
 */
const cockpit: SkinManifest = {
	id: 'cockpit',
	name: 'Cockpit',
	tagline: 'A trading terminal: amber on black, gridded data tiles, a <GO> command line.',
	order: 3,
	defaultPalette: 'ck-amber',
	palettes: [
		{
			id: 'ck-amber',
			name: 'Amber Terminal',
			kind: 'dark',
			description: 'The classic desk: amber and orange data on pure black',
		},
		{
			id: 'ck-refinitiv',
			name: 'Eikon Navy',
			kind: 'dark',
			description: 'Deep navy tiles with cyan headers and crisp white figures',
		},
		{
			id: 'ck-floor',
			name: 'Trading Floor',
			kind: 'dark',
			description: 'LED-board green and red on black, like the tape above the pit',
		},
		{
			id: 'ck-carbon',
			name: 'Carbon Blue',
			kind: 'dark',
			description: 'Graphite panels with an electric blue edge',
		},
		{
			id: 'ck-daylight',
			name: 'Daylight Desk',
			kind: 'light',
			description: 'Light grey terminal with navy type and an orange signal',
		},
	],
	fonts: {
		ui: ['plex-condensed', 'share-tech', 'plex-mono'],
		display: "'IBM Plex Sans Condensed', 'Big Shoulders Display', sans-serif",
		code: 'plex',
	},
	layout: {
		activity: 'top',
		activityLabels: true,
		sidebar: 'left',
		statusBar: 'bottom',
		gap: 2,
	},
};

export default cockpit;
