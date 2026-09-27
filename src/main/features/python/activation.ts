import { existsSync } from 'node:fs';
import { basename, delimiter, dirname, join, resolve } from 'node:path';

import { envDirOf } from './envs';

const WIN = process.platform === 'win32';

/** Env var names are case-insensitive on Windows, and a copied env keeps whatever casing it had. */
function keyOf(env: NodeJS.ProcessEnv, name: string): string {
	if (!WIN) return name;
	return Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
}

function norm(path: string): string {
	const full = resolve(path);
	return WIN ? full.toLowerCase() : full;
}

const samePath = (a: string, b: string): boolean => norm(a) === norm(b);

/**
 * PATH entries `conda activate` puts first. Conda's DLLs live in Library\bin; without it numpy,
 * ssl, sqlite and friends fail to import on Windows even though python.exe starts.
 */
function condaBins(envDir: string): string[] {
	if (!WIN) return [join(envDir, 'bin')];
	return [
		envDir,
		join(envDir, 'Library', 'mingw-w64', 'bin'),
		join(envDir, 'Library', 'usr', 'bin'),
		join(envDir, 'Library', 'bin'),
		join(envDir, 'Scripts'),
		join(envDir, 'bin'),
	];
}

/** What `conda activate` puts in CONDA_DEFAULT_ENV: the env's name, 'base', or its path. */
function condaEnvName(envDir: string): string {
	if (basename(dirname(envDir)).toLowerCase() === 'envs') return basename(envDir);
	return existsSync(join(envDir, 'condabin')) ? 'base' : envDir;
}

/**
 * Environment that makes a child process behave as if the env were activated: its folders on
 * PATH, VIRTUAL_ENV for venvs, CONDA_PREFIX for conda. No Activate.ps1, so execution policy never
 * matters. Anvil itself may have been started from a shell with another env active: variables
 * pointing at a different interpreter are dropped, or tools such as uv, poetry and pip would act
 * on the wrong environment. A stale venv's Scripts folder leaves PATH too; a stale conda env's
 * entries stay (behind ours), since its `conda` command and DLLs may still be needed.
 */
export function activatedEnv(
	python: string,
	base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...base };
	const envDir = envDirOf(python);
	const isVenv = existsSync(join(envDir, 'pyvenv.cfg'));
	const isConda = !isVenv && existsSync(join(envDir, 'conda-meta'));

	/** Removes `name` unless it describes this interpreter; returns the dropped value. */
	const drop = (name: string, belongs: (value: string) => boolean): string | null => {
		const key = keyOf(env, name);
		const value = env[key];
		if (value === undefined || (value !== '' && belongs(value))) return null;
		Reflect.deleteProperty(env, key);
		return value || null;
	};
	const staleVenv = drop('VIRTUAL_ENV', (v) => isVenv && samePath(v, envDir));
	drop('CONDA_PREFIX', (v) => isConda && samePath(v, envDir));
	// PYTHONHOME from another install makes python fail at startup ("init_fs_encoding").
	drop('PYTHONHOME', (v) => samePath(v, envDir));
	if (!isConda) {
		Reflect.deleteProperty(env, keyOf(env, 'CONDA_DEFAULT_ENV'));
		Reflect.deleteProperty(env, keyOf(env, 'CONDA_PROMPT_MODIFIER'));
	}

	const bins = isConda ? condaBins(envDir) : [dirname(python)];
	const scripts = join(envDir, WIN ? 'Scripts' : 'bin');
	if (!isConda && !bins.some((b) => samePath(b, scripts)) && existsSync(scripts))
		bins.push(scripts);
	const pathKey = keyOf(env, 'PATH');
	const rest = (env[pathKey] ?? '')
		.split(delimiter)
		.filter(
			(p) =>
				p !== '' && !(staleVenv && samePath(p, join(staleVenv, WIN ? 'Scripts' : 'bin'))),
		);
	env[pathKey] = [...bins, ...rest].join(delimiter);

	if (isVenv) env[keyOf(env, 'VIRTUAL_ENV')] = envDir;
	if (isConda) {
		env[keyOf(env, 'CONDA_PREFIX')] = envDir;
		env[keyOf(env, 'CONDA_DEFAULT_ENV')] = condaEnvName(envDir);
	}
	return env;
}
