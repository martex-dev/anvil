import { z } from 'zod';

import { defineChannels } from '../define';

export const AiProviderSchema = z.enum(['anthropic', 'openai', 'gemini', 'ollama']);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const AiMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().max(400_000),
});
export type AiMessage = z.infer<typeof AiMessageSchema>;

export const AiContextKindSchema = z.enum([
	'file',
	'selection',
	'diff',
	'problems',
	'terminal',
	'notebook',
]);
export type AiContextKind = z.infer<typeof AiContextKindSchema>;

export const AiContextSchema = z.object({
	kind: AiContextKindSchema,
	/** e.g. "src/app.py" or "git diff". */
	label: z.string().max(500),
	language: z.string().max(50).nullable(),
	text: z.string().max(400_000),
});
export type AiContext = z.infer<typeof AiContextSchema>;

/**
 * What the request is for; picks the system prompt. `edit` must answer with only the
 * replacement code, `commit` with only a commit message.
 */
export const AiModeSchema = z.enum(['chat', 'edit', 'commit']);
export type AiMode = z.infer<typeof AiModeSchema>;

export const AiModelRefSchema = z.object({
	provider: AiProviderSchema,
	model: z.string().min(1).max(100),
});
export type AiModelRef = z.infer<typeof AiModelRefSchema>;

export const AiSettingsSchema = z.object({
	/** Chat, inline edit and one-click actions. */
	chat: AiModelRefSchema,
	/** Ghost-text autocomplete: should be fast and cheap. */
	completion: AiModelRefSchema,
	/** Local Ollama server (OpenAI-compatible API). */
	ollamaUrl: z.url({ protocol: /^https?$/ }),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

const RequestIdSchema = z.string().uuid();

export const aiChannels = defineChannels({
	'ai:settings': { input: z.void(), output: AiSettingsSchema },
	'ai:setSettings': { input: AiSettingsSchema, output: AiSettingsSchema },
	/** Which providers are usable (a saved key; Ollama needs none). Keys never leave main. */
	'ai:keys': { input: z.void(), output: z.record(AiProviderSchema, z.boolean()) },
	/** Starts a streamed reply; text arrives as `ai:delta` events for this request id. */
	'ai:send': {
		input: z.object({
			requestId: RequestIdSchema,
			mode: AiModeSchema.default('chat'),
			model: AiModelRefSchema,
			messages: z.array(AiMessageSchema).min(1).max(200),
			context: z.array(AiContextSchema).max(20),
		}),
		output: z.void(),
	},
	'ai:cancel': { input: RequestIdSchema, output: z.void() },
	/** Ghost-text completion at the cursor. Empty text = nothing worth suggesting. */
	'ai:complete': {
		input: z.object({
			requestId: RequestIdSchema,
			path: z.string().max(4096),
			language: z.string().max(50),
			prefix: z.string().max(20_000),
			suffix: z.string().max(8_000),
		}),
		output: z.object({ text: z.string() }),
	},
	/** `git diff` of the open folder (capped): working tree vs HEAD, or only what's staged. */
	'ai:gitDiff': {
		input: z.object({ staged: z.boolean() }),
		output: z.object({ diff: z.string(), truncated: z.boolean() }),
	},
});

export const aiEvents = {
	'ai:delta': z.object({ requestId: RequestIdSchema, text: z.string() }),
	'ai:done': z.object({
		requestId: RequestIdSchema,
		inputTokens: z.number().nullable(),
		outputTokens: z.number().nullable(),
		cancelled: z.boolean(),
	}),
	'ai:error': z.object({ requestId: RequestIdSchema, message: z.string() }),
};
