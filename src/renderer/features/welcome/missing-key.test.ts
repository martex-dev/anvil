import { describe, expect, it } from 'vitest';

import type { AiProvider, AiSettings } from '@shared/ipc/channels/ai';

import { missingKeyProvider } from './missing-key';

const settings: AiSettings = {
	chat: { provider: 'anthropic', model: 'claude' },
	completion: { provider: 'openai', model: 'gpt' },
	ollamaUrl: 'http://localhost:11434',
};

const keys = (anthropic: boolean): Record<AiProvider, boolean> => ({
	anthropic,
	openai: true,
	gemini: false,
	ollama: true,
});

describe('missingKeyProvider', () => {
	it('names the chat provider when its key is missing', () => {
		expect(missingKeyProvider(settings, keys(false))).toBe('anthropic');
	});

	it('is null when the chat provider has a key', () => {
		expect(missingKeyProvider(settings, keys(true))).toBeNull();
	});

	it('is null while settings or keys are loading or failed', () => {
		expect(missingKeyProvider(settings, undefined)).toBeNull();
		expect(missingKeyProvider(undefined, keys(false))).toBeNull();
	});
});
