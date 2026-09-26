import {
	MutationObserver,
	type MutationObserverOptions,
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { DEFAULT_SETTINGS, editorFontFamily, type Settings } from '@shared/settings';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { queryClient } from '../../lib/query-client';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { themeById } from '../../styles/theme-list';
import { syncWindowChrome } from '../window-chrome';

export const SETTINGS_KEY = ['settings'] as const;
const SETTINGS_MUTATION_KEY = ['settings', 'update'] as const;

interface SettingsSnapshot {
	previous: Settings | undefined;
}

/**
 * `settings:update` as an optimistic mutation: the patch lands in the cache at once, so a second
 * click (a stepper's +, a status bar toggle) builds on the first instead of on the stale value.
 * While several saves are in flight, their responses and `settings:changed` events are ignored
 * (they may be older than the optimistic state); the last one to settle refetches the truth.
 */
export function settingsMutationOptions(
	client: QueryClient,
): MutationObserverOptions<Settings, Error, Partial<Settings>, SettingsSnapshot> {
	const onlyPending = (): boolean =>
		client.isMutating({ mutationKey: SETTINGS_MUTATION_KEY }) === 1;
	return {
		mutationKey: SETTINGS_MUTATION_KEY,
		mutationFn: (patch) => call('settings:update', patch),
		onMutate: async (patch) => {
			await client.cancelQueries({ queryKey: SETTINGS_KEY });
			const previous = client.getQueryData<Settings>(SETTINGS_KEY);
			// Without loaded settings there is nothing real to merge into; the response fills it.
			if (previous) client.setQueryData<Settings>(SETTINGS_KEY, { ...previous, ...patch });
			return { previous };
		},
		onSuccess: (next) => {
			if (onlyPending()) client.setQueryData(SETTINGS_KEY, next);
		},
		onError: (_error, _patch, snapshot) => {
			if (onlyPending() && snapshot?.previous)
				client.setQueryData(SETTINGS_KEY, snapshot.previous);
		},
		onSettled: async (_data, error) => {
			// A failed save among several leaves the cache unknowable locally: ask main.
			if (onlyPending() && error) await client.invalidateQueries({ queryKey: SETTINGS_KEY });
		},
	};
}

/** Whether a settings save is still in flight, so pushed snapshots may be stale. */
export function isSavingSettings(client: QueryClient = queryClient): boolean {
	return client.isMutating({ mutationKey: SETTINGS_MUTATION_KEY }) > 0;
}

export function useSettings(): {
	settings: Settings;
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
	update: (patch: Partial<Settings>) => void;
} {
	const client = useQueryClient();
	const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => call('settings:get') });
	const options = settingsMutationOptions(client);
	const mutation = useMutation({
		...options,
		onError: (error, patch, snapshot, context) => {
			void options.onError?.(error, patch, snapshot, context);
			toast.error('Could not save settings', error.message);
		},
	});
	return {
		settings: query.data ?? DEFAULT_SETTINGS,
		isLoading: query.isLoading,
		error: query.data ? null : query.error,
		refetch: () => void query.refetch(),
		update: mutation.mutate,
	};
}

/** Current settings outside React (commands, Monaco providers). */
export function getSettings(): Settings {
	return queryClient.getQueryData<Settings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
}

/** Saves a patch outside React, optimistically like `useSettings().update`; rejects on failure. */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
	await new MutationObserver(queryClient, settingsMutationOptions(queryClient)).mutate(patch);
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

/** The settings `paintSavedAppearance` put on <html> before React mounted. */
let bootPainted: Settings | undefined;

/**
 * Loads the saved settings and paints them before the first React render, so launching never
 * flashes the default theme, accent or glass. A failure is logged; the UI then shows its own
 * error state.
 */
export async function paintSavedAppearance(): Promise<void> {
	try {
		const settings = await queryClient.fetchQuery({
			queryKey: SETTINGS_KEY,
			queryFn: () => call('settings:get'),
		});
		bootPainted = settings;
		applyAppearance(settings);
	} catch (error) {
		rlog.error('settings', 'could not load settings before the first paint', error);
	}
}

/** Mounted once: applies appearance settings to <html> and follows changes from main. */
export function useApplySettings(): void {
	const client = useQueryClient();
	const { data } = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => call('settings:get') });
	useAnvilEvent('settings:changed', (next) => {
		// Our own saves echo back before they resolve; the mutation reconciles those itself.
		if (!isSavingSettings(client)) client.setQueryData(SETTINGS_KEY, next);
	});
	useEffect(() => {
		// Defaults are never painted over the real theme while settings are still loading, and
		// the boot paint is not repeated (each paint makes Monaco and xterm rebuild their themes).
		if (data && data !== bootPainted) applyAppearance(data);
	}, [data]);
	useEffect(() => {
		// Coalesced like the editor refresh: the theme picker fires one event per keypress.
		let timer: ReturnType<typeof setTimeout> | undefined;
		const sync = (): void => {
			clearTimeout(timer);
			timer = setTimeout(syncWindowChrome, 60);
		};
		window.addEventListener('anvil:appearance', sync);
		// The boot paint (paintSavedAppearance) may have announced itself before this listener
		// existed, and it is not repeated, so match the title bar to it once on mount.
		sync();
		return () => {
			clearTimeout(timer);
			window.removeEventListener('anvil:appearance', sync);
		};
	}, []);
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
		paintCustomAccent(settings.customAccent);
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

/**
 * Paints a custom accent onto the UI's tokens only, without the `anvil:appearance` rebuild of
 * Monaco and xterm: cheap enough for every step of a color-picker drag.
 */
export function paintCustomAccent(hex: string): void {
	const root = document.documentElement;
	root.dataset['accent'] = 'custom';
	root.style.setProperty('--accent', hex);
	root.style.setProperty(
		'--on-accent',
		isLightColor(hex) ? 'var(--on-accent-dark)' : 'var(--on-accent-light)',
	);
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
