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
	/**
	 * System Pythons (PATH, `py -0p`) from the last discovery. Finding them spawns processes, so
	 * resolve() can't do it synchronously; discovery feeds them in here instead.
	 */
	private system: readonly string[] = [];
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
		this.notify();
	}

	/**
	 * Records discovered system interpreters. Listeners hear about it only when that changes the
	 * folder's interpreter, so a folder with its own venv doesn't restart its language server.
	 */
	setSystem(root: string | null, paths: readonly string[]): void {
		const before = this.resolve(root);
		this.system = [...paths];
		if (this.resolve(root) !== before) this.notify();
	}

	/** A change found on disk (a venv created or deleted): every listener re-resolves. */
	announce(): void {
		this.notify();
	}

	private notify(): void {
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
		return candidates(root)[0]?.path ?? this.system.find((p) => existsSync(p)) ?? null;
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
