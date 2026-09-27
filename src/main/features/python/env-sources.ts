import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

import type { PythonEnvKind } from '@shared/ipc/channels/python';

/** One interpreter found on disk, before its version is asked for. */
export interface Candidate {
	path: string;
	kind: PythonEnvKind;
	label: string;
	local: boolean;
}

const WIN = process.platform === 'win32';

/** Subfolders of `dir`; a folder that doesn't exist (the tool isn't installed) has none. */
async function subdirs(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries.filter((d) => d.isDirectory()).map((d) => join(dir, d.name));
	} catch {
		return [];
	}
}

/**
 * `envs_dirs:` from a .condarc: a YAML block list (`- path`) or flow list (`[a, b]`). Only this
 * key matters, so a line-based read is enough; `~` means the home folder, as in conda.
 */
export function parseEnvsDirs(condarc: string, home = homedir()): string[] {
	const lines = condarc.split(/\r?\n/);
	const start = lines.findIndex((l) => /^envs_dirs\s*:/.test(l));
	if (start === -1) return [];
	const expand = (raw: string): string => {
		const p = raw.trim().replace(/^['"]|['"]$/g, '');
		return p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? join(home, p.slice(1)) : p;
	};
	const inline = /^envs_dirs\s*:\s*\[(.*)\]\s*$/.exec(lines[start] ?? '');
	if (inline) return (inline[1] ?? '').split(',').map(expand).filter(Boolean);
	const out: string[] = [];
	for (const line of lines.slice(start + 1)) {
		const item = /^\s*-\s*(.+?)\s*$/.exec(line);
		if (item?.[1]) out.push(expand(item[1]));
		else if (line.trim() !== '' && !line.trim().startsWith('#')) break;
	}
	return out;
}

async function condarcEnvDirs(condaRoots: readonly string[]): Promise<string[]> {
	const home = homedir();
	const files = [
		join(home, '.condarc'),
		join(home, '.conda', '.condarc'),
		join(home, '.config', 'conda', '.condarc'),
		...condaRoots.map((r) => join(r, '.condarc')),
	];
	const dirs = await Promise.all(
		files.map((f) =>
			readFile(f, 'utf8').then(
				(text) => parseEnvsDirs(text, home),
				// No .condarc there: the usual case.
				() => [],
			),
		),
	);
	return dirs.flat();
}

/** Folders whose subfolders are environments, with how to label and classify them. */
interface EnvParent {
	dir: string;
	kind: PythonEnvKind;
	prefix: string;
}

function envParents(condaDirs: readonly string[]): EnvParent[] {
	const home = homedir();
	const appData = process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming');
	const pyenvRoot =
		process.env['PYENV_ROOT'] ?? join(home, '.pyenv', ...(WIN ? ['pyenv-win'] : []));
	const poetry =
		process.env['POETRY_VIRTUALENVS_PATH'] ??
		(WIN
			? join(appData, 'pypoetry', 'virtualenvs')
			: process.platform === 'darwin'
				? join(home, 'Library', 'Caches', 'pypoetry', 'virtualenvs')
				: join(home, '.cache', 'pypoetry', 'virtualenvs'));
	return [
		// `conda create -n` without write access to the install puts envs here.
		{ dir: join(home, '.conda', 'envs'), kind: 'conda', prefix: 'conda' },
		...condaDirs.map((dir) => ({ dir, kind: 'conda' as const, prefix: 'conda' })),
		{ dir: join(pyenvRoot, 'versions'), kind: 'system', prefix: 'pyenv' },
		{ dir: poetry, kind: 'venv', prefix: 'poetry' },
		// pipenv (and virtualenvwrapper) keep envs in WORKON_HOME, ~/.virtualenvs by default.
		{
			dir: process.env['WORKON_HOME'] ?? join(home, '.virtualenvs'),
			kind: 'venv',
			prefix: 'pipenv',
		},
		...(WIN
			? []
			: [
					{
						dir: join(home, '.local', 'share', 'virtualenvs'),
						kind: 'venv' as const,
						prefix: 'pipenv',
					},
				]),
	];
}

/**
 * Environments kept outside the open folder and the conda / uv installs: ~/.conda/envs and
 * .condarc `envs_dirs`, pyenv(-win) versions, poetry and pipenv virtualenvs. Read with async fs
 * calls in parallel, so a missing tool costs one failed readdir.
 */
export async function externalEnvs(
	condaRoots: readonly string[],
	interpreterIn: (envDir: string) => string | null,
): Promise<Candidate[]> {
	const parents = envParents(await condarcEnvDirs(condaRoots));
	const found = await Promise.all(
		parents.map(async ({ dir, kind, prefix }) =>
			(await subdirs(dir)).flatMap((env): Candidate[] => {
				const python = interpreterIn(env);
				return python
					? [{ path: python, kind, label: `${prefix}: ${basename(env)}`, local: false }]
					: [];
			}),
		),
	);
	return found.flat();
}

/**
 * Microsoft Store Pythons. Their interpreters are app execution aliases in
 * %LOCALAPPDATA%\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.x_<id>\python.exe; the
 * bare WindowsApps\python.exe next to them may be the installer stub, so it's never used.
 */
export async function storePythons(): Promise<Candidate[]> {
	if (!WIN) return [];
	const apps = join(
		process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local'),
		'Microsoft',
		'WindowsApps',
	);
	return (await subdirs(apps))
		.filter((d) => /^PythonSoftwareFoundation\.Python\.3/i.test(basename(d)))
		.map((d) => {
			const version = /Python\.(3\.\d+)/i.exec(basename(d))?.[1] ?? '3';
			return {
				path: join(d, 'python.exe'),
				kind: 'system' as const,
				label: `Microsoft Store Python ${version}`,
				local: false,
			};
		});
}

/** A real Store Python alias (see storePythons), not the bare installer stub. */
export function isStorePython(path: string): boolean {
	return /[\\/]WindowsApps[\\/]PythonSoftwareFoundation\.Python\.3[^\\/]*[\\/]python[\d.]*\.exe$/i.test(
		path,
	);
}
