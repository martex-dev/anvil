import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { AiModelRef, AiProvider, AiSettings } from '@shared/ipc/channels/ai';

import { call } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { parseModelChoice } from './model-ref';

export const AI_SETTINGS_KEY = ['ai', 'settings'] as const;
export const AI_KEYS_KEY = ['ai', 'keys'] as const;

export const PROVIDER_LABEL: Record<AiProvider, string> = {
	anthropic: 'Claude',
	openai: 'OpenAI',
	gemini: 'Gemini',
	ollama: 'Ollama (local)',
};

/** Starting points for the model picker; any id the provider accepts can be typed in. */
export const SUGGESTED_MODELS: Array<AiModelRef & { note: string; completion?: boolean }> = [
	{ provider: 'anthropic', model: 'claude-opus-5', note: 'Best for coding · default' },
	{ provider: 'anthropic', model: 'claude-sonnet-5', note: 'Fast and strong' },
	{
		provider: 'anthropic',
		model: 'claude-haiku-4-5',
		note: 'Fastest · great for autocomplete',
		completion: true,
	},
	{ provider: 'anthropic', model: 'claude-opus-5-5', note: 'Newest Opus' },
	{ provider: 'anthropic', model: 'claude-fable-5-1', note: 'Most capable, slower and pricier' },
	{ provider: 'openai', model: 'gpt-5', note: 'OpenAI flagship' },
	{ provider: 'openai', model: 'gpt-5-mini', note: 'Cheap and quick', completion: true },
	{ provider: 'gemini', model: 'gemini-2.5-pro', note: 'Google flagship' },
	{ provider: 'gemini', model: 'gemini-2.5-flash', note: 'Fast', completion: true },
	{
		provider: 'ollama',
		model: 'qwen2.5-coder:7b',
		note: 'Local, free · FIM autocomplete',
		completion: true,
	},
	{ provider: 'ollama', model: 'llama3.1:8b', note: 'Local, free' },
];

export function useAiSettings(): {
	settings: AiSettings | undefined;
	/** undefined while loading (or failed): not the same as "no key". */
	keys: Record<AiProvider, boolean> | undefined;
	/** Why settings or keys could not be loaded, if they couldn't. */
	error: Error | null;
	retry: () => void;
} {
	const client = useQueryClient();
	const settings = useQuery({ queryKey: AI_SETTINGS_KEY, queryFn: () => call('ai:settings') });
	const keys = useQuery({ queryKey: AI_KEYS_KEY, queryFn: () => call('ai:keys') });
	useAnvilEvent(
		'secrets:changed',
		() => void client.invalidateQueries({ queryKey: AI_KEYS_KEY }),
	);
	return {
		settings: settings.data,
		keys: keys.data,
		error: settings.error ?? keys.error,
		retry: () => {
			if (settings.isError) void settings.refetch();
			if (keys.isError) void keys.refetch();
		},
	};
}

export async function getAiSettings(): Promise<AiSettings> {
	return queryClient.fetchQuery({
		queryKey: AI_SETTINGS_KEY,
		queryFn: () => call('ai:settings'),
		staleTime: 30_000,
	});
}

export async function saveAiSettings(next: AiSettings): Promise<void> {
	queryClient.setQueryData(AI_SETTINGS_KEY, await call('ai:setSettings', next));
}

/** Picks the model for chat (or autocomplete); typing an id not in the list uses it as-is. */
export async function pickModel(slot: 'chat' | 'completion'): Promise<void> {
	const settings = await getAiSettings();
	const current = settings[slot];
	const items = SUGGESTED_MODELS.filter((m) => slot === 'chat' || m.completion).map((m) => ({
		id: `${m.provider}|${m.model}`,
		label: m.model,
		description: `${PROVIDER_LABEL[m.provider]} · ${m.note}`,
		current: m.provider === current.provider && m.model === current.model,
	}));
	const picked = await quickPick({
		title: slot === 'chat' ? 'chat model' : 'autocomplete model',
		placeholder: 'Pick a model, or type provider|model-id (e.g. openai|gpt-5)',
		items,
		allowCustom: { label: (text) => `Use "${text}"` },
	});
	if (!picked) return;
	const choice = parseModelChoice(
		picked.startsWith('custom:') ? picked.slice(7) : picked,
		current.provider,
	);
	if (!choice.ok) {
		toast.error(choice.title, choice.detail);
		return;
	}
	await saveAiSettings({ ...settings, [slot]: choice.ref });
	toast.success(slot === 'chat' ? 'Chat model set' : 'Autocomplete model set', choice.ref.model);
}
