import { PALETTES } from '../skins/registry';
import type { PaletteMeta } from '../skins/types';

/**
 * Every palette of every skin. Skins own their palettes (skins/<id>/palettes.css plus the
 * manifest); this is the flat view for code that only needs "is this palette light or dark".
 */
export type ThemeMeta = PaletteMeta;

export const THEMES: readonly ThemeMeta[] = PALETTES;

export const DEFAULT_THEME = 'cyber';

export function themeById(id: string): ThemeMeta {
	const found = THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME);
	if (!found) throw new Error('The default palette is missing');
	return found;
}
