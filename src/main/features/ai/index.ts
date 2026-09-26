import { type AiProvider, type AiSettings, AiSettingsSchema } from '@shared/ipc/channels/ai';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { AiService, gitDiff } from './ai-service';
import { PROVIDER_SECRET } from './providers';

/**
 * Chat on the strongest model, ghost text on a fast cheap one. Model ids are editable in the
 * AI settings; these are the starting points.
 */
export const DEFAULT_AI: AiSettings = {
	chat: { provider: 'anthropic', model: 'claude-opus-5' },
	completion: { provider: 'anthropic', model: 'claude-haiku-4-5' },
	ollamaUrl: 'http://127.0.0.1:11434',
};

export const aiFeature: MainFeature = {
	id: 'ai',
	activate(ctx) {
		const settings = (): AiSettings =>
			ctx.settings.get('settings', AiSettingsSchema, DEFAULT_AI);
		const keyOf = (provider: AiProvider): string | null =>
			provider === 'ollama' ? '' : ctx.getSecret(PROVIDER_SECRET[provider]);
		// e2e only: a local mock that speaks each provider's protocol.
		const mock = process.env['ANVIL_E2E'] === '1' ? process.env['ANVIL_AI_API'] : undefined;
		const ai = new AiService({
			getKey: keyOf,
			ollamaUrl: () => settings().ollamaUrl,
			baseOverride: mock,
		});
		ctx.onDispose(() => ai.cancelAll());

		ctx.ipc.handle('ai:settings', settings);
		ctx.ipc.handle('ai:setSettings', (next) =>
			ctx.settings.set('settings', AiSettingsSchema, next),
		);
		ctx.ipc.handle('ai:keys', () => ({
			anthropic: Boolean(keyOf('anthropic')),
			openai: Boolean(keyOf('openai')),
			gemini: Boolean(keyOf('gemini')),
			ollama: true,
		}));
		ctx.ipc.handle('ai:send', ({ requestId, mode, model, messages, context }) => {
			// Fire and forget: the reply streams back as events, so the IPC call returns at once.
			void ai.stream(requestId, mode, model, messages, context, {
				delta: (text) => ctx.emit('ai:delta', { requestId, text }),
				done: (usage, cancelled) => ctx.emit('ai:done', { requestId, ...usage, cancelled }),
				error: (message) => {
					ctx.log.warn('ai request failed', { ...model, mode, message });
					ctx.emit('ai:error', { requestId, message });
				},
			});
		});
		ctx.ipc.handle('ai:cancel', (requestId) => ai.cancel(requestId));
		ctx.ipc.handle('ai:complete', async ({ requestId, ...input }) => {
			try {
				return { text: await ai.complete(requestId, settings().completion, input) };
			} catch (error) {
				// Surface it (the status bar shows the reason) but never as an unhandled crash.
				throw new AnvilError(
					'AI_COMPLETE_FAILED',
					error instanceof Error ? error.message : String(error),
				);
			}
		});
		ctx.ipc.handle('ai:gitDiff', ({ staged }) => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('AI_NO_FOLDER', 'Open a folder to attach its git diff');
			return gitDiff(root, staged);
		});
	},
};
