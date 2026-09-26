import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { DEFAULT_SETTINGS, editorFontFamily, type Settings } from '@shared/settings';

import { call } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { themeById } from '../../styles/theme-list';

export const SETTINGS_KEY = ['settings'] as const;

export function useSettings(): {
	settings: Settings;
	isLoading: boolean;
	update: (patch: Partial<Settings>) => void;
} {
	const client = useQueryClient();
	const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => call('settings:get') });
	const mutation = useMutation({
		mutationFn: (patch: Partial<Settings>) => call('settings:update', patch),
		onSuccess: (next) => client.setQueryData(SETTINGS_KEY, next),
		onError: (error) => toast.error('Could not save settings', error.message),
	});
	return {
		settings: query.data ?? DEFAULT_SETTINGS,
		isLoading: query.isLoading,
		update: mutation.mutate,
	};
}

/** Current settings outside React (commands, Monaco providers). */
export function getSettings(): Settings {
	return queryClient.getQueryData<Settings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
	const next = await call('settings:update', patch);
	queryClient.setQueryData(SETTINGS_KEY, next);
}

/**
 * Calls `onChange` whenever `key` changes in the cached settings, whoever changed it: the status
 * bar, Settings, a command, or main via `settings:changed`. Returns the unsubscribe.
 */
export function watchSetting<K extends keyof Settings>(
	key: K,
	onChange: (value: Settings[K]) => void,
	client: QueryClient = queryClient,
): () => void {
	const read = (): Settings[K] =>
		(client.getQueryData<Settings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS)[key];
	let last = read();
	return client.getQueryCache().subscribe((event) => {
		if (event.type !== 'updated' || event.query.queryKey[0] !== SETTINGS_KEY[0]) return;
		const next = read();
		if (Object.is(next, last)) return;
		last = next;
		onChange(next);
	});
}

/** Mounted once: applies appearance settings to <html> and follows changes from main. */
export function useApplySettings(): void {
	const client = useQueryClient();
	const { settings } = useSettings();
	useAnvilEvent('settings:changed', (next) => client.setQueryData(SETTINGS_KEY, next));
	useEffect(() => {
		applyAppearance(settings);
	}, [settings]);
}

/** Theme, accent, glass and fonts onto <html>; editors and terminals re-read the tokens after. */
export function applyAppearance(settings: Settings): void {
	const root = document.documentElement;
	const theme = themeById(settings.theme);
	root.style.setProperty('--ui-font-size', `${settings.uiFontSize}px`);
	root.style.setProperty('--font-code', editorFontFamily(settings.editorFont));
	root.dataset['theme'] = theme.id;
	root.dataset['accent'] = settings.accent;
	if (settings.accent === 'custom') {
		root.style.setProperty('--accent', settings.customAccent);
		root.style.setProperty(
			'--on-accent',
			isLightColor(settings.customAccent)
				? 'var(--on-accent-dark)'
				: 'var(--on-accent-light)',
		);
	} else {
		root.style.removeProperty('--accent');
		root.style.removeProperty('--on-accent');
	}
	root.dataset['glass'] = settings.glass;
	root.dataset['ambient'] = String(settings.ambient);
	root.dataset['reduceMotion'] = String(settings.reduceMotion);
	root.dataset['neonCursor'] = String(settings.neonCursor);
	root.dataset['rainbowIndent'] = String(settings.rainbowIndent);
	root.dataset['tabTint'] = String(settings.tabTint);
	// Monaco and xterm take concrete colors, so they rebuild once the new tokens are live.
	requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('anvil:appearance')));
}

/** Whether dark text reads better than white on this `#rrggbb` (WCAG relative luminance). */
export function isLightColor(hex: string): boolean {
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
	if (!m) return true;
	const [r = 0, g = 0, b = 0] = [m[1], m[2], m[3]].map((h) => {
		const c = parseInt(h ?? '0', 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	// Equal contrast against black and white sits at luminance ≈ 0.179.
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179;
}

/** Live preview while browsing the theme picker; `null` restores the saved settings. */
export function previewTheme(themeId: string | null): void {
	const settings = getSettings();
	applyAppearance(themeId ? { ...settings, theme: themeId } : settings);
}
