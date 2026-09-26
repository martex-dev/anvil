import { z } from 'zod';

import { defineChannels } from '../define';

export const PythonEnvKindSchema = z.enum(['venv', 'uv', 'conda', 'system']);
export type PythonEnvKind = z.infer<typeof PythonEnvKindSchema>;

export const PythonEnvSchema = z.object({
	/** Absolute path of the interpreter; also the id. */
	path: z.string(),
	label: z.string(),
	kind: PythonEnvKindSchema,
	/** e.g. "3.12.4"; null if the interpreter didn't answer. */
	version: z.string().nullable(),
	/** Lives inside the open folder (.venv / venv). */
	local: z.boolean(),
});
export type PythonEnv = z.infer<typeof PythonEnvSchema>;

export const PythonPackageSchema = z.object({ name: z.string(), version: z.string() });
export type PythonPackage = z.infer<typeof PythonPackageSchema>;

export const PythonToolsSchema = z.object({
	ipython: z.boolean(),
	ruff: z.boolean(),
	pytest: z.boolean(),
});
export type PythonTools = z.infer<typeof PythonToolsSchema>;

export const pythonChannels = defineChannels({
	/** Interpreters found for the open folder: local venvs, conda envs, PATH pythons. */
	'python:envs': { input: z.object({ refresh: z.boolean() }), output: z.array(PythonEnvSchema) },
	/** The interpreter used for Run, the REPL, LSP and tools (per folder); null = auto. */
	'python:selected': { input: z.void(), output: PythonEnvSchema.nullable() },
	'python:select': { input: z.string().min(1).max(1024).nullable(), output: z.void() },
	/** Installed packages of the selected env (pip list). */
	'python:packages': { input: z.void(), output: z.array(PythonPackageSchema) },
	'python:tools': { input: z.void(), output: PythonToolsSchema },
	/**
	 * Writes a `# %%` cell (or selection) to a temp file and returns the REPL command that
	 * runs it in the current namespace.
	 */
	'python:stageCell': {
		input: z.object({ code: z.string().max(2_000_000) }),
		output: z.object({ command: z.string() }),
	},
	/** Formats Python source with ruff (the env's, or one on PATH). */
	'python:format': {
		input: z.object({ path: z.string().max(4096), content: z.string().max(10_000_000) }),
		output: z.object({ content: z.string() }),
	},
	/** The shell command that runs a file with the selected interpreter. */
	'python:runCommand': {
		input: z.object({ path: z.string().min(1).max(4096), module: z.boolean() }),
		output: z.object({ command: z.string() }),
	},
});

export const pythonEvents = {
	'python:changed': PythonEnvSchema.nullable(),
};
