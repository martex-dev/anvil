import { z } from 'zod';

import { defineChannels } from '../define';

export const LspLanguageSchema = z.enum(['python', 'typescript']);
export type LspLanguage = z.infer<typeof LspLanguageSchema>;

const SessionSchema = z.string().uuid();

export const LspStartResultSchema = z.object({
	session: SessionSchema,
	/** file:// URI of the workspace folder the server was started for. */
	rootUri: z.string(),
	/** Monaco language ids the server handles. */
	languageIds: z.array(z.string()),
	initializationOptions: z.record(z.string(), z.unknown()),
});
export type LspStartResult = z.infer<typeof LspStartResultSchema>;

/**
 * Language servers run in main (child processes); LSP JSON-RPC messages are relayed as-is
 * between them and the renderer's language client.
 */
export const lspChannels = defineChannels({
	/** Starts a fresh server for the open folder (replacing an earlier one for that language). */
	'lsp:start': { input: z.object({ language: LspLanguageSchema }), output: LspStartResultSchema },
	'lsp:send': {
		input: z.object({ session: SessionSchema, message: z.record(z.string(), z.unknown()) }),
		output: z.void(),
	},
	'lsp:stop': { input: z.object({ session: SessionSchema }), output: z.void() },
});

export const lspEvents = {
	'lsp:message': z.object({ session: SessionSchema, message: z.unknown() }),
	'lsp:exit': z.object({
		session: SessionSchema,
		code: z.number().nullable(),
		/** Last lines of the server's stderr, for the error shown to the user. */
		stderr: z.string(),
	}),
};
