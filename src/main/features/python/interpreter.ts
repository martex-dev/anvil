import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

import { candidates, envDirOf } from './envs';

/**
 * The Python every feature uses for the open folder: Run, the REPL, the language server,
 * ruff and the data viewer. An explicit pick wins; otherwise the folder's own venv, then
 * whatever else is installed.
 */
class InterpreterState {
	private readonly picked = new Map<string, string | null>();
	private readonly listeners = new Set<() => void>();
	private loadPick: (root: string) => string | null = () => null;
	private savePick: (root: string, path: string | null) => void = () => undefined;

	configure(
		load: (root: string) => string | null,
		save: (root: string, path: string | null) => void,
	): void {
		this.loadPick = load;
		this.savePick = save;
	}

	pick(root: string, path: string | null): void {
		this.picked.set(root.toLowerCase(), path);
		this.savePick(root, path);
		for (const listener of this.listeners) listener();
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** The explicit pick for this folder, if it still exists. */
	explicit(root: string): string | null {
		const key = root.toLowerCase();
		if (!this.picked.has(key)) this.picked.set(key, this.loadPick(root));
		const path = this.picked.get(key) ?? null;
		return path && existsSync(path) ? path : null;
	}

	/** Resolved interpreter for a folder (or for no folder at all). Null if none is installed. */
	resolve(root: string | null): string | null {
		if (root) {
			const explicit = this.explicit(root);
			if (explicit) return explicit;
		}
		return candidates(root)[0]?.path ?? null;
	}
}

export const interpreter = new InterpreterState();

/**
 * Environment that makes a child process behave as if the env were activated: its folder and
 * Scripts/bin on PATH, VIRTUAL_ENV for venvs. No Activate.ps1, so execution policy never matters.
 */
export function activatedEnv(
	python: string,
	base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...base };
	const envDir = envDirOf(python);
	const bins = [dirname(python)];
	const scripts = join(envDir, process.platform === 'win32' ? 'Scripts' : 'bin');
	if (!bins.includes(scripts) && existsSync(scripts)) bins.push(scripts);
	const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
	env[pathKey] = [...bins, env[pathKey] ?? ''].join(delimiter);
	if (existsSync(join(envDir, 'pyvenv.cfg'))) env['VIRTUAL_ENV'] = envDir;
	else if (existsSync(join(envDir, 'conda-meta'))) env['CONDA_PREFIX'] = envDir;
	return env;
}

/** Where the REPL helper script and staged cells live; set by the Python feature on start. */
let replSupport: { startup: string; cells: string } | null = null;

export function setReplSupport(support: { startup: string; cells: string }): void {
	replSupport = support;
}

/** Env that loads the `_cell(n)` helper into a REPL. */
export function replEnv(): Record<string, string> {
	return replSupport
		? { PYTHONSTARTUP: replSupport.startup, ANVIL_CELLS: replSupport.cells }
		: {};
}
