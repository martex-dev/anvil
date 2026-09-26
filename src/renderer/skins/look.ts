import { editorFontFamily, uiFontFamily } from '@shared/fonts';
import type { Settings } from '@shared/settings';

import { paletteFor, skinById } from './registry';
import type { PaletteMeta, SkinLayout, SkinManifest } from './types';

/** Everything the document needs to render the chosen skin. */
export interface Look {
	skin: SkinManifest;
	palette: PaletteMeta;
	uiFontId: string;
	uiFont: string;
	displayFont: string;
	codeFontId: string;
	codeFont: string;
	layout: SkinLayout;
}

/** Palette and UI font remembered for this skin (Cyber Glass keeps using `theme`). */
export function savedPalette(settings: Settings, skinId: string): string | undefined {
	return settings.skinPrefs[skinId]?.palette ?? (skinId === 'cyber' ? settings.theme : undefined);
}

export function resolveLook(settings: Settings): Look {
	const skin = skinById(settings.skin);
	const palette = paletteFor(skin, savedPalette(settings, skin.id));
	const wantedUi = settings.skinPrefs[skin.id]?.uiFont;
	const uiFontId =
		wantedUi && skin.fonts.ui.some((f) => f === wantedUi)
			? wantedUi
			: (skin.fonts.ui[0] ?? 'geist');
	const codeFontId = settings.editorFont === 'skin' ? skin.fonts.code : settings.editorFont;
	const side = settings.sidebarSide;
	const layout: SkinLayout =
		side === 'skin' || skin.layout.sidebar === 'drawer'
			? skin.layout
			: { ...skin.layout, sidebar: side };
	return {
		skin,
		palette,
		uiFontId,
		uiFont: uiFontFamily(uiFontId) ?? "'Geist Sans', system-ui, sans-serif",
		displayFont: skin.fonts.display,
		codeFontId,
		codeFont: editorFontFamily(codeFontId),
		layout,
	};
}

/** Settings patch that switches palette inside the current skin. */
export function palettePatch(settings: Settings, paletteId: string): Partial<Settings> {
	const skinId = skinById(settings.skin).id;
	const prefs = {
		...settings.skinPrefs,
		[skinId]: { ...settings.skinPrefs[skinId], palette: paletteId },
	};
	return skinId === 'cyber' ? { theme: paletteId, skinPrefs: prefs } : { skinPrefs: prefs };
}

/** Settings patch that switches the UI font inside the current skin. */
export function uiFontPatch(settings: Settings, fontId: string): Partial<Settings> {
	const skinId = skinById(settings.skin).id;
	return {
		skinPrefs: {
			...settings.skinPrefs,
			[skinId]: { ...settings.skinPrefs[skinId], uiFont: fontId },
		},
	};
}
