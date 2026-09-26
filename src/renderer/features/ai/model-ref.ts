import {
	type AiModelRef,
	AiModelRefSchema,
	type AiProvider,
	AiProviderSchema,
} from '@shared/ipc/channels/ai';

export type ModelChoice =
	{ ok: true; ref: AiModelRef } | { ok: false; title: string; detail: string };

const EXAMPLE = 'e.g. anthropic|claude-opus-5';

/**
 * Reads what was typed in the model picker: `provider|model-id`, or a bare model id for the
 * current provider. Errors are worded for a toast rather than as raw schema messages.
 */
export function parseModelChoice(raw: string, currentProvider: AiProvider): ModelChoice {
	const bar = raw.indexOf('|');
	const providerText = bar === -1 ? currentProvider : raw.slice(0, bar).trim().toLowerCase();
	const model = (bar === -1 ? raw : raw.slice(bar + 1)).trim();
	const provider = AiProviderSchema.safeParse(providerText);
	if (!provider.success)
		return {
			ok: false,
			title: 'Unknown provider',
			detail: `Use anthropic, openai, gemini or ollama, ${EXAMPLE}`,
		};
	if (!model)
		return {
			ok: false,
			title: 'No model id',
			detail: `Type the model after the |, ${EXAMPLE}`,
		};
	if (model.includes('|'))
		return {
			ok: false,
			title: 'Invalid model id',
			detail: `Use a single | between provider and model, ${EXAMPLE}`,
		};
	const ref = AiModelRefSchema.safeParse({ provider: provider.data, model });
	if (!ref.success)
		return {
			ok: false,
			title: 'Invalid model id',
			detail: 'Model ids are at most 100 characters.',
		};
	return { ok: true, ref: ref.data };
}
