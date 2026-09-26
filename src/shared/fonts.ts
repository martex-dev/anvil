/**
 * Fonts bundled with Anvil (woff2, loaded on first use). Code fonts can be used with any skin;
 * UI fonts are offered by the skins that list them. 'skin' means "whatever the skin uses".
 */
export const EDITOR_FONTS = [
	{ id: 'jetbrains', name: 'JetBrains Mono', family: 'JetBrains Mono', ligatures: true },
	{ id: 'fira', name: 'Fira Code', family: 'Fira Code', ligatures: true },
	{ id: 'cascadia', name: 'Cascadia Code', family: 'Cascadia Code', ligatures: true },
	{ id: 'geist', name: 'Geist Mono', family: 'Geist Mono', ligatures: false },
	{ id: 'monaspace', name: 'Monaspace Neon', family: 'Monaspace Neon', ligatures: true },
	{ id: 'maple', name: 'Maple Mono', family: 'Maple Mono', ligatures: true },
	{ id: 'victor', name: 'Victor Mono', family: 'Victor Mono', ligatures: true },
	{ id: 'iosevka', name: 'Iosevka', family: 'Iosevka', ligatures: true },
	{ id: 'plex', name: 'IBM Plex Mono', family: 'IBM Plex Mono', ligatures: false },
	{ id: 'space-mono', name: 'Space Mono', family: 'Space Mono', ligatures: false },
	{ id: 'share-tech', name: 'Share Tech Mono', family: 'Share Tech Mono', ligatures: false },
	{ id: 'vt323', name: 'VT323 (CRT)', family: 'VT323', ligatures: false },
] as const;
export type EditorFontId = (typeof EDITOR_FONTS)[number]['id'];
export const EDITOR_FONT_IDS = EDITOR_FONTS.map((f) => f.id) as [EditorFontId, ...EditorFontId[]];

export const UI_FONTS = [
	{ id: 'geist', name: 'Geist Sans', family: 'Geist Sans' },
	{ id: 'inter-tight', name: 'Inter Tight', family: 'Inter Tight' },
	{ id: 'space-grotesk', name: 'Space Grotesk', family: 'Space Grotesk' },
	{ id: 'plex-condensed', name: 'IBM Plex Sans Condensed', family: 'IBM Plex Sans Condensed' },
	{ id: 'rajdhani', name: 'Rajdhani', family: 'Rajdhani' },
	{ id: 'chakra-petch', name: 'Chakra Petch', family: 'Chakra Petch' },
	{ id: 'newsreader', name: 'Newsreader', family: 'Newsreader' },
	{ id: 'fraunces', name: 'Fraunces', family: 'Fraunces' },
	{ id: 'nunito', name: 'Nunito', family: 'Nunito' },
	{ id: 'baloo', name: 'Baloo 2', family: 'Baloo 2' },
	{ id: 'comfortaa', name: 'Comfortaa', family: 'Comfortaa' },
	{ id: 'pixelify', name: 'Pixelify Sans', family: 'Pixelify Sans' },
	{ id: 'tiny5', name: 'Tiny5', family: 'Tiny5' },
	{ id: 'plex-mono', name: 'IBM Plex Mono', family: 'IBM Plex Mono' },
	{ id: 'share-tech', name: 'Share Tech Mono', family: 'Share Tech Mono' },
	{ id: 'vt323', name: 'VT323', family: 'VT323' },
] as const;
export type UiFontId = (typeof UI_FONTS)[number]['id'];

const MONO_FALLBACK = `'JetBrains Mono', ui-monospace, monospace`;

/** CSS font stack for a code font id; unknown ids get JetBrains Mono. */
export function editorFontFamily(id: string): string {
	const font = EDITOR_FONTS.find((f) => f.id === id) ?? EDITOR_FONTS[0];
	return `'${font.family}', ${MONO_FALLBACK}`;
}

/** CSS font stack for a UI font id, or null when the id isn't known. */
export function uiFontFamily(id: string): string | null {
	const font = UI_FONTS.find((f) => f.id === id);
	return font ? `'${font.family}', 'Geist Sans', system-ui, sans-serif` : null;
}
