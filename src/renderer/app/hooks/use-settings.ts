import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { DEFAULT_SETTINGS, type Settings } from '@shared/settings';

import { call } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';

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

/** Mounted once: applies appearance settings to <html> and follows changes from main. */
export function useApplySettings(): void {
	const client = useQueryClient();
	const { settings } = useSettings();
	useAnvilEvent('settings:changed', (next) => client.setQueryData(SETTINGS_KEY, next));
	useEffect(() => {
		const root = document.documentElement;
		root.style.setProperty('--ui-font-size', `${settings.uiFontSize}px`);
		root.dataset['accent'] = settings.accent;
		root.dataset['glass'] = settings.glass;
		root.dataset['ambient'] = String(settings.ambient);
		root.dataset['reduceMotion'] = String(settings.reduceMotion);
	}, [
		settings.uiFontSize,
		settings.accent,
		settings.glass,
		settings.ambient,
		settings.reduceMotion,
	]);
}
