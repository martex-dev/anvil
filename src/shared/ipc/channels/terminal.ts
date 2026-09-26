import { z } from 'zod';

import { defineChannels } from '../define';

export const TerminalPresetIdSchema = z.enum([
	'powershell',
	'cmd',
	'gitbash',
	'python',
	'repl',
	'claude',
	'codex',
	'gemini',
]);
export type TerminalPresetId = z.infer<typeof TerminalPresetIdSchema>;

export const TerminalPresetSchema = z.object({
	id: TerminalPresetIdSchema,
	label: z.string(),
	available: z.boolean(),
	/** Shown when unavailable, e.g. the npm command that installs the CLI. */
	installHint: z.string().nullable(),
	reason: z.string().nullable(),
});
export type TerminalPreset = z.infer<typeof TerminalPresetSchema>;

const SessionId = z.string().regex(/^[a-zA-Z0-9-]{8,64}$/);
const Size = z.number().int().min(2).max(1000);

export const terminalChannels = defineChannels({
	'terminal:presets': { input: z.void(), output: z.array(TerminalPresetSchema) },
	/** Attaches to a live session, or starts one with this id if none exists. */
	'terminal:open': {
		input: z.object({
			sessionId: SessionId,
			preset: TerminalPresetIdSchema,
			cols: Size,
			rows: Size,
			/** Typed into the shell once it starts (Run file, tasks). */
			initialCommand: z.string().max(10_000).optional(),
		}),
		output: z.object({
			sessionId: z.string(),
			title: z.string(),
			cwd: z.string(),
			/** Output produced before this call (reattach after a reload). */
			backlog: z.string(),
			running: z.boolean(),
		}),
	},
	/**
	 * False when nothing was written: no such session (never started, or ended with the app) or
	 * its process exited. With `restart`, an exited session is started again first.
	 */
	'terminal:write': {
		input: z.object({
			sessionId: SessionId,
			data: z.string().max(1_000_000),
			restart: z.boolean().optional(),
		}),
		output: z.boolean(),
	},
	'terminal:resize': {
		input: z.object({ sessionId: SessionId, cols: Size, rows: Size }),
		output: z.void(),
	},
	'terminal:restart': {
		input: z.object({ sessionId: SessionId, cols: Size, rows: Size }),
		output: z.void(),
	},
	'terminal:kill': { input: SessionId, output: z.void() },
});

export const terminalEvents = {
	'terminal:data': z.object({ sessionId: z.string(), data: z.string() }),
	'terminal:exit': z.object({ sessionId: z.string(), exitCode: z.number().int() }),
};
