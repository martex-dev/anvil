import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import type { PythonEnv, PythonEnvKind } from '@shared/ipc/channels/python';

const WIN = process.platform === 'win32';

/** Interpreter inside an environment folder (venv, conda env, uv-managed install). */
export function interpreterIn(envDir: string): string | null {
	const candidates = WIN
		? [join(envDir, 'Scripts', 'python.exe'), join(envDir, 'python.exe')]
		: [join(envDir, 'bin', 'python3'), join(envDir, 'bin', 'python')];
	return candidates.find((p) => existsSync(p)) ?? null;
}

/** `version = 3.12.4` (venv) or `version_info = 3.12.4.final.0` (uv). */
export function parsePyvenvVersion(cfg: string): string | null {
	const m = /^\s*version(?:_info)?\s*=\s*(\d+\.\d+(?:\.\d+)?)/m.exec(cfg);
	return m?.[1] ?? null;
}

/** The environment folder of an interpreter (its parent, or the parent of Scripts/bin). */
export function envDirOf(python: string): string {
	const dir = dirname(python);
	const name = basename(dir).toLowerCase();
	return name === 'scripts' || name === 'bin' ? dirname(dir) : dir;
}

function readPyvenv(envDir: string): string | null {
	try {
		return parsePyvenvVersion(readFileSync(join(envDir, 'pyvenv.cfg'), 'utf8'));
	} catch {
		return null;
	}
}

function run(file: string, args: string[], timeout = 6_000): Promise<string | null> {
	return new Promise((resolve) => {
		execFile(file, args, { windowsHide: true, timeout }, (error, stdout) =>
			resolve(error ? null : stdout),
		);
	});
}

async function versionOf(python: string): Promise<string | null> {
	const fromCfg = readPyvenv(envDirOf(python));
	if (fromCfg) return fromCfg;
	const out = await run(python, ['-c', "import sys;print('%d.%d.%d' % sys.version_info[:3])"]);
	return out?.trim() || null;
}

function subdirs(dir: string): string[] {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => join(dir, d.name));
	} catch {
		return [];
	}
}

interface Candidate {
	path: string;
	kind: PythonEnvKind;
	label: string;
	local: boolean;
}

function condaRoots(): string[] {
	const home = homedir();
	const roots = ['anaconda3', 'miniconda3', 'miniforge3', 'mambaforge'].flatMap((n) => [
		join(home, n),
		...(WIN ? [join('C:\\ProgramData', n)] : []),
	]);
	const fromEnv = process.env['CONDA_PREFIX'];
	if (fromEnv)
		roots.unshift(
			dirname(fromEnv).toLowerCase().endsWith('envs') ? dirname(dirname(fromEnv)) : fromEnv,
		);
	return [...new Set(roots)].filter((r) => existsSync(r));
}

function uvRoot(): string | null {
	const dir = WIN
		? join(process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'), 'uv', 'python')
		: join(homedir(), '.local', 'share', 'uv', 'python');
	return existsSync(dir) ? dir : null;
}

/** Every interpreter we can find without asking the user. Local venvs first. */
export function candidates(root: string | null): Candidate[] {
	const out: Candidate[] = [];
	if (root) {
		for (const name of ['.venv', 'venv', 'env', '.env']) {
			const python = interpreterIn(join(root, name));
			if (python) {
				const uv = existsSync(join(root, 'uv.lock'));
				out.push({ path: python, kind: uv ? 'uv' : 'venv', label: name, local: true });
			}
		}
	}
	for (const conda of condaRoots()) {
		const base = interpreterIn(conda);
		if (base)
			out.push({
				path: base,
				kind: 'conda',
				label: `conda: base (${basename(conda)})`,
				local: false,
			});
		for (const env of subdirs(join(conda, 'envs'))) {
			const python = interpreterIn(env);
			if (python)
				out.push({
					path: python,
					kind: 'conda',
					label: `conda: ${basename(env)}`,
					local: false,
				});
		}
	}
	const uv = uvRoot();
	if (uv) {
		for (const install of subdirs(uv)) {
			const python = interpreterIn(install);
			if (python)
				out.push({
					path: python,
					kind: 'uv',
					label: `uv: ${basename(install)}`,
					local: false,
				});
		}
	}
	return out;
}

/** Pythons on PATH and, on Windows, the ones the `py` launcher knows about. */
async function systemPythons(): Promise<Candidate[]> {
	const found: string[] = [];
	if (WIN) {
		const py = await run('py', ['-0p']);
		for (const line of py?.split(/\r?\n/) ?? []) {
			const m = /([A-Za-z]:\\.*python\.exe)\s*$/i.exec(line.trim());
			if (m?.[1]) found.push(m[1]);
		}
		const where = await run('where.exe', ['python']);
		for (const line of where?.split(/\r?\n/) ?? []) {
			const p = line.trim();
			// The Microsoft Store alias only opens the Store; it isn't an interpreter.
			if (p && !/WindowsApps/i.test(p)) found.push(p);
		}
	} else {
		for (const name of ['python3', 'python']) {
			const p = (await run('which', [name]))?.trim();
			if (p) found.push(p);
		}
	}
	return found.map((path) => ({ path, kind: 'system', label: `system: ${path}`, local: false }));
}

const sameFile = (a: string, b: string): boolean =>
	WIN ? a.toLowerCase() === b.toLowerCase() : a === b;

export async function discoverEnvs(root: string | null): Promise<PythonEnv[]> {
	const all = [...candidates(root), ...(await systemPythons())];
	const unique: Candidate[] = [];
	for (const c of all) if (!unique.some((u) => sameFile(u.path, c.path))) unique.push(c);
	const versions = await Promise.all(unique.map((c) => versionOf(c.path)));
	return unique.map((c, i) => ({
		path: c.path,
		label: c.label,
		kind: c.kind,
		version: versions[i] ?? null,
		local: c.local,
	}));
}
