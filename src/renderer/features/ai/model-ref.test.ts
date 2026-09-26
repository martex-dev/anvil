import { describe, expect, it } from 'vitest';

import { parseModelChoice } from './model-ref';

describe('parseModelChoice', () => {
	it('reads provider|model, trimming both parts', () => {
		expect(parseModelChoice(' OpenAI | gpt-5 ', 'anthropic')).toEqual({
			ok: true,
			ref: { provider: 'openai', model: 'gpt-5' },
		});
	});

	it('uses the current provider for a bare model id', () => {
		expect(parseModelChoice('claude-sonnet-5', 'anthropic')).toEqual({
			ok: true,
			ref: { provider: 'anthropic', model: 'claude-sonnet-5' },
		});
	});

	it('rejects prototype keys and unknown providers', () => {
		expect(parseModelChoice('constructor|x', 'anthropic')).toMatchObject({
			ok: false,
			title: 'Unknown provider',
		});
		expect(parseModelChoice('mistral|large', 'anthropic')).toMatchObject({ ok: false });
	});

	it('explains an empty, piped or overlong model id', () => {
		expect(parseModelChoice('openai| ', 'anthropic')).toMatchObject({
			ok: false,
			title: 'No model id',
		});
		expect(parseModelChoice('openai|gpt|5', 'anthropic')).toMatchObject({ ok: false });
		expect(parseModelChoice(`openai|${'x'.repeat(101)}`, 'anthropic')).toMatchObject({
			ok: false,
			detail: 'Model ids are at most 100 characters.',
		});
	});
});
