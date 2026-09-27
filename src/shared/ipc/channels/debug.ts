import { z } from 'zod';

import { defineChannels } from '../define';

const SessionSchema = z.string().uuid();
/** A workspace-relative file; main resolves it through the fs guard. */
const RelPathSchema = z.string().min(1).max(4096);
const IdentifierPath = /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/;

/**
 * What to debug. The renderer only names the target: main picks the interpreter, resolves the
 * path inside the open folder and builds debugpy's launch configuration itself.
 */
export const DebugTargetSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('file'), path: RelPathSchema }),
	/** `python -m pkg.mod` */
	z.object({ kind: z.literal('module'), module: z.string().max(256).regex(IdentifierPath) }),
	/** `python -m pytest path::Class::test` */
	z.object({
		kind: z.literal('pytest'),
		path: RelPathSchema,
		test: z
			.string()
			.max(512)
			.regex(/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/),
	}),
]);
export type DebugTarget = z.infer<typeof DebugTargetSchema>;

export const DebugStartResultSchema = z.discriminatedUnion('status', [
	z.object({
		status: z.literal('started'),
		session: SessionSchema,
		/** Absolute path of the interpreter the adapter (and the program) runs with. */
		python: z.string(),
		/**
		 * The open folder as the adapter spells paths: symlinks and Windows 8.3 short names
		 * (C:\Users\PCGAME~1) resolved, so stack frames map back to workspace files.
		 */
		root: z.string(),
	}),
	/** debugpy isn't importable from the selected interpreter. Nothing was started. */
	z.object({
		status: z.literal('missing'),
		python: z.string(),
		/** Short name of the environment, e.g. ".venv" or "conda: base". */
		env: z.string(),
		/** Shell command (for Anvil's terminal) that installs debugpy into that environment. */
		installCommand: z.string(),
	}),
]);
export type DebugStartResult = z.infer<typeof DebugStartResultSchema>;

/** A Debug Adapter Protocol message (request, response or event), relayed as-is. */
const DapMessageSchema = z.record(z.string(), z.unknown());

/**
 * debugpy's adapter runs in main (a child process of the selected Python); DAP messages are
 * relayed between it and the renderer's debug client, like the LSP relay does.
 */
export const debugChannels = defineChannels({
	'debug:start': {
		input: z.object({ target: DebugTargetSchema, justMyCode: z.boolean() }),
		output: DebugStartResultSchema,
	},
	/** A launch request's arguments are replaced by the configuration main built on start. */
	'debug:send': {
		input: z.object({ session: SessionSchema, message: DapMessageSchema }),
		output: z.void(),
	},
	/** Ends the debuggee (if still running) and the adapter. */
	'debug:stop': { input: z.object({ session: SessionSchema }), output: z.void() },
});

export const debugEvents = {
	'debug:message': z.object({ session: SessionSchema, message: DapMessageSchema }),
	/**
	 * The adapter asked to start the program in a terminal (DAP `runInTerminal`). Main already
	 * turned its argument list into a shell command; the renderer types it into a fresh terminal
	 * and answers the request (`seq`) through debug:send.
	 */
	'debug:runInTerminal': z.object({
		session: SessionSchema,
		seq: z.number().int(),
		title: z.string(),
		command: z.string(),
	}),
	'debug:exit': z.object({
		session: SessionSchema,
		code: z.number().nullable(),
		/** Last lines of the adapter's stderr, for the error shown when it crashed. */
		stderr: z.string(),
	}),
};
