import type { SkinManifest } from '../types';

/**
 * Workbench 95: Anvil as a 1995 desktop program. Grey bevelled chrome, navy title bars, a teal
 * desktop behind child windows, sunken white fields, pixel-art icons and a taskbar.
 */
const workbench: SkinManifest = {
	id: 'workbench',
	name: 'Workbench 95',
	tagline: 'A 1995 desktop program: bevelled grey chrome, navy title bars, a taskbar.',
	order: 4,
	defaultPalette: 'wb-classic',
	palettes: [
		{
			id: 'wb-classic',
			name: 'Classic',
			kind: 'light',
			description: 'Silver chrome and navy title bars on a teal desktop',
		},
		{
			id: 'wb-storm',
			name: 'Storm',
			kind: 'dark',
			description: 'High-contrast charcoal with violet title bars and yellow focus',
		},
		{
			id: 'wb-rose',
			name: 'Rose',
			kind: 'light',
			description: 'Dusty rose chrome over a deep mauve desktop',
		},
		{
			id: 'wb-plum',
			name: 'Plum',
			kind: 'light',
			description: 'Heather grey chrome, aubergine title bars and a plum desktop',
		},
		{
			id: 'wb-hotdog',
			name: 'Hot Dog Stand',
			kind: 'light',
			description: 'The infamous one: ketchup red chrome on a mustard desktop',
		},
	],
	fonts: {
		ui: ['pixelify', 'geist', 'tiny5'],
		display: "'Workbench Digits', 'Pixelify Sans', 'Geist Sans', system-ui, sans-serif",
		code: 'plex',
	},
	layout: {
		activity: 'top',
		activityLabels: false,
		sidebar: 'left',
		statusBar: 'bottom',
		gap: 4,
	},
};

export default workbench;
