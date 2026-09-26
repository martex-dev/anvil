import type { AiProvider, AiSettings } from '@shared/ipc/channels/ai';

/**
 * The chat provider whose API key is known to be missing, or null. While either query is still
 * loading (or failed) nothing is known, so the Welcome banner stays hidden instead of flashing.
 */
export function missingKeyProvider(
	settings: AiSettings | undefined,
	keys: Record<AiProvider, boolean> | undefined,
): AiProvider | null {
	if (!settings || !keys) return null;
	const provider = settings.chat.provider;
	return keys[provider] ? null : provider;
}
