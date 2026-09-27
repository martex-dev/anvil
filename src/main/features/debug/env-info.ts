import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { psQuote, shQuote } from '../../core/shell-quote';
import { activatedEnv } from '../python/interpreter';

/** The environment folder of an interpreter: its parent, or the parent of Scripts/bin. */
function envDir(python: string): string {
	const dir = dirname(python);
	const name = basename(dir).toLowerCase();
	return name === 'scripts' || name === 'bin' ? dirname(dir) : dir;
}

function readCfg(dir: string): string | null {
	try {
		return readFileSync(join(dir, 'pyvenv.cfg'), 'utf8');
	} catch {
		return null;
	}
}

export interface EnvInfo {
	/** ".venv", "conda: research", or the interpreter path. */
	label: string;
	/** Created by uv: such venvs have no pip, so installs go through `uv pip`. */
	uv: boolean;
}

export function envInfo(python: string, root: string | null): EnvInfo {
	const dir = envDir(python);
	// uv writes its own version into pyvenv.cfg (`uv = 0.5.1`); plain venvs don't.
	const uv = /^\s*uv\s*=/m.test(readCfg(dir) ?? '');
	const inside = root ? relative(root, dir) : '';
	if (root && inside && !inside.startsWith('..') && !/^[a-zA-Z]:/.test(inside))
		return { label: inside.replace(/\\/g, '/'), uv };
	if (existsSync(join(dir, 'conda-meta'))) return { label: `conda: ${basename(dir)}`, uv };
	return { label: python, uv };
}

/** The shell line that installs debugpy into that interpreter's environment. */
export function installCommand(
	python: string,
	uv: boolean,
	platform: NodeJS.Platform = process.platform,
): string {
	const q = platform === 'win32' ? psQuote : shQuote;
	if (uv) return `uv pip install --python ${q(python)} debugpy`;
	return platform === 'win32'
		? `& ${q(python)} -m pip install debugpy`
		: `${q(python)} -m pip install debugpy`;
}

/** Interpreters known to have debugpy; misses are re-checked, since the user may install it. */
const withDebugpy = new Set<string>();

export function hasDebugpy(python: string): Promise<boolean> {
	if (withDebugpy.has(python)) return Promise.resolve(true);
	return new Promise((resolve) => {
		execFile(
			python,
			['-c', 'import debugpy'],
			{ env: activatedEnv(python), windowsHide: true, timeout: 15_000 },
			(error) => {
				if (!error) withDebugpy.add(python);
				resolve(!error);
			},
		);
	});
}
