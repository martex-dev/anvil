/**
 * Screenshot thumbnails for the skin gallery (`./<skin>/preview.webp`, made with
 * scripts/skin-shots.mts --previews). A skin without one gets a drawn schematic instead.
 */
const images = import.meta.glob<string>('./*/preview.webp', {
	eager: true,
	query: '?url',
	import: 'default',
});

export function previewFor(skin: string): string | undefined {
	return images[`./${skin}/preview.webp`];
}
