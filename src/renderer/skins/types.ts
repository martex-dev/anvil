import type { ComponentType } from 'react';

import type { EditorFontId, UiFontId } from '@shared/fonts';

/** A color variant of a skin. Its colors are one `[data-theme='<id>']` block in palettes.css. */
export interface PaletteMeta {
	/** Globally unique across skins (prefix with the skin id, e.g. 'mf-amber'). */
	id: string;
	name: string;
	kind: 'dark' | 'light';
	/** One line, e.g. 'Neon cyan on deep space glass'. */
	description: string;
}

/**
 * Where the chrome goes. Skins pick a layout; the user can still flip the side bar and
 * collapse panes.
 */
export interface SkinLayout {
	/** Views switcher: a vertical bar, a strip above the workbench, or a hover-reveal rail. */
	activity: 'left' | 'right' | 'top' | 'rail';
	/** Text labels next to (or instead of) view icons, e.g. 'F1 FILES'. */
	activityLabels: boolean;
	sidebar: 'left' | 'right' | 'drawer';
	statusBar: 'top' | 'bottom';
	/** Gap between panes in px: 0 for tiled skins, larger for floating ones. */
	gap: number;
	/** Center the editor text in a column this wide (px), for writer-style skins. */
	editorColumn?: number;
	/**
	 * The skin fades its chrome until the pointer comes near it. A description for pickers and
	 * docs: the skin's own CSS does the fading.
	 */
	autoHideChrome?: boolean;
}

export interface SkinFonts {
	/** UI fonts the skin offers; the first is the default. */
	ui: readonly UiFontId[];
	/** CSS font stack for headings and HUD labels. */
	display: string;
	/** The skin's default code font. */
	code: EditorFontId;
}

export interface SkinManifest {
	id: string;
	name: string;
	/** Short pitch shown on the skin card. */
	tagline: string;
	/** Sort order in pickers. */
	order: number;
	palettes: readonly PaletteMeta[];
	defaultPalette: string;
	fonts: SkinFonts;
	layout: SkinLayout;
}

/** Names of the icons the chrome asks a skin for. Content icons stay lucide, styled by CSS. */
export const CHROME_ICONS = [
	'explorer',
	'search',
	'git',
	'run',
	'outline',
	'todos',
	'history',
	'snippets',
	'toolbox',
	'ai',
	'settings',
	'terminal',
	'problems',
	'play',
	'close',
	'plus',
	'split',
	'menu',
	'sidebar',
	'panel',
	'minimize',
	'maximize',
	'restore',
	'palette',
] as const;
export type ChromeIconName = (typeof CHROME_ICONS)[number];

export interface IconProps {
	size: number;
	className?: string | undefined;
}
export type IconSet = Partial<Record<ChromeIconName, ComponentType<IconProps>>>;

/**
 * Optional replacement chrome. Anything left out uses the shared component, which skins
 * restyle through `[data-part]` hooks in their CSS.
 */
export interface SkinChrome {
	TitleBar?: ComponentType;
	ActivityBar?: ComponentType;
	StatusBar?: ComponentType;
	/** Extra bar under the title bar (command line, window list). */
	Top?: ComponentType;
	/** Extra bar at the very bottom (F-key bar, taskbar). */
	Bottom?: ComponentType;
	/** Replaces the ambient background layer. */
	Backdrop?: ComponentType;
	/** Drawn above everything, pointer-events off (scanlines, vignette, grain). */
	Overlay?: ComponentType;
	WindowControls?: ComponentType;
}
