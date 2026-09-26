import type { PaletteMeta, SkinManifest } from './types';

/**
 * Every skin lives in its own folder and is picked up from its manifest, so adding a skin
 * never means editing a shared list.
 */
const modules = import.meta.glob<{ default: SkinManifest }>('./*/manifest.ts', { eager: true });

export const SKINS: readonly SkinManifest[] = Object.values(modules)
	.map((m) => m.default)
	.sort((a, b) => a.order - b.order);

export const DEFAULT_SKIN = 'cyber';

export function skinById(id: string | undefined): SkinManifest {
	const found = SKINS.find((s) => s.id === id) ?? SKINS.find((s) => s.id === DEFAULT_SKIN);
	if (!found) throw new Error('The default skin is missing');
	return found;
}

/** Every palette of every skin, tagged with its skin. */
export const PALETTES: ReadonlyArray<PaletteMeta & { skin: string }> = SKINS.flatMap((s) =>
	s.palettes.map((p) => ({ ...p, skin: s.id })),
);

/** A palette of this skin; unknown ids fall back to the skin's default. */
export function paletteFor(skin: SkinManifest, id: string | undefined): PaletteMeta {
	const found =
		skin.palettes.find((p) => p.id === id) ??
		skin.palettes.find((p) => p.id === skin.defaultPalette);
	if (!found) throw new Error(`Skin ${skin.id} has no default palette`);
	return found;
}
