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

/** One user variable in the REPL, summarised for the Variables panel (repl-vars.ts). */
export const ReplVariableSchema = z.object({
	name: z.string().max(256),
	/** e.g. `int`, `pandas.DataFrame`, `numpy.ndarray float64`. */
	type: z.string().max(256),
	/** Shape (`1000 x 5`) or length; empty when neither applies. */
	size: z.string().max(128),
	/** A one-line, bounded repr. */
	value: z.string().max(400),
});
export type ReplVariable = z.infer<typeof ReplVariableSchema>;
export const ReplVariablesSchema = z.array(ReplVariableSchema).max(500);

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
		input: z.object({
			code: z.string().max(2_000_000),
			/** The file and line the code starts at, so tracebacks point at the real source. */
			source: z
				.object({
					path: z.string().max(4096),
					line: z.number().int().min(1).max(10_000_000),
				})
				.optional(),
		}),
		output: z.object({ command: z.string() }),
	},
	/** Formats Python source with ruff (the env's, or one on PATH). */
	'python:format': {
		input: z.object({ path: z.string().max(4096), content: z.string().max(10_000_000) }),
		output: z.object({ content: z.string() }),
	},
	/** The shell command that runs a file with the selected interpreter. */
	/** The REPL's variables as of its last run (empty before a REPL has started). */
	'python:vars': { input: z.void(), output: ReplVariablesSchema },
	'python:runCommand': {
		input: z.object({ path: z.string().min(1).max(4096), module: z.boolean() }),
		output: z.object({ command: z.string() }),
	},
});

export const pythonEvents = {
	/** The REPL finished running something; its variables as they are now. */
	'python:vars': ReplVariablesSchema,
	/** `root`: the folder it was resolved for, so a late event never lands on the next folder. */
	'python:changed': z.object({
		root: z.string().nullable(),
		env: PythonEnvSchema.nullable(),
	}),
};
