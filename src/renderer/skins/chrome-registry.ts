import type { IconSet, SkinChrome } from './types';

/**
 * Optional per-skin React parts, discovered like manifests: `./<skin>/chrome.tsx` (replacement
 * chrome) and `./<skin>/icons.tsx` (its icon set). Kept apart from the manifests so settings and
 * tests can read skin data without loading UI code.
 */
const chromeModules = import.meta.glob<{ default: SkinChrome }>('./*/chrome.tsx', {
	eager: true,
});
const iconModules = import.meta.glob<{ default: IconSet }>('./*/icons.tsx', { eager: true });

const bySkin = <T>(modules: Record<string, { default: T }>): Record<string, T> =>
	Object.fromEntries(
		Object.entries(modules).map(([path, m]) => [path.split('/')[1] ?? '', m.default]),
	);

const CHROME = bySkin(chromeModules);
const ICONS = bySkin(iconModules);

export function chromeFor(skin: string): SkinChrome {
	return CHROME[skin] ?? {};
}

export function iconsFor(skin: string): IconSet {
	return ICONS[skin] ?? {};
}
