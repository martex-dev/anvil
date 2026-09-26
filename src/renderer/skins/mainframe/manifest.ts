import type { SkinManifest } from '../types';

/**
 * Mainframe: the editor as a text-mode program. Everything monospace, panes box-drawn like a
 * TUI, a tmux window list on top, a vim status line and an F-key bar at the bottom, all under
 * the scanlines of a 1983 terminal tube.
 */
const mainframe: SkinManifest = {
	id: 'mainframe',
	name: 'Mainframe',
	tagline: 'A terminal program: box-drawn panes, F-keys, phosphor glow.',
	order: 1,
	defaultPalette: 'mf-green',
	palettes: [
		{
			id: 'mf-green',
			name: 'P1 Green',
			kind: 'dark',
			description: 'Green phosphor glowing on a near-black tube',
		},
		{
			id: 'mf-amber',
			name: 'P3 Amber',
			kind: 'dark',
			description: 'Warm amber phosphor, the long-persistence office terminal',
		},
		{
			id: 'mf-ibm',
			name: '3270 Fields',
			kind: 'dark',
			description: 'IBM 3270 field colors: green input, blue labels, red alarms, white heads',
		},
		{
			id: 'mf-vt',
			name: 'VT White',
			kind: 'dark',
			description: 'DEC white phosphor on a cool grey glass',
		},
		{
			id: 'mf-greenbar',
			name: 'Greenbar',
			kind: 'light',
			description: 'Line-printer greenbar paper with black and red ribbon ink',
		},
	],
	fonts: {
		ui: ['vt323', 'plex-mono', 'share-tech'],
		display: "'VT323', 'IBM Plex Mono', ui-monospace, monospace",
		code: 'plex',
	},
	layout: {
		activity: 'top',
		activityLabels: true,
		sidebar: 'left',
		statusBar: 'bottom',
		gap: 0,
	},
};

export default mainframe;
