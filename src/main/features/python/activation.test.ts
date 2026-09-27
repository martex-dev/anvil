import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { activatedEnv } from './activation';

const WIN = process.platform === 'win32';
const BIN = WIN ? 'Scripts' : 'bin';

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-act-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function venv(name: string): string {
	mkdirSync(join(dir, name, BIN), { recursive: true });
	writeFileSync(join(dir, name, 'pyvenv.cfg'), 'version = 3.12.4\n');
	const python = join(dir, name, BIN, WIN ? 'python.exe' : 'python3');
	writeFileSync(python, '');
	return python;
}

/** A conda env: python.exe at the env root on Windows, bin/python elsewhere. */
function conda(envDir: string): string {
	mkdirSync(join(envDir, 'conda-meta'), { recursive: true });
	const python = WIN ? join(envDir, 'python.exe') : join(envDir, 'bin', 'python');
	mkdirSync(join(python, '..'), { recursive: true });
	writeFileSync(python, '');
	return python;
}

describe('activatedEnv', () => {
	it('drops a venv, conda env and PYTHONHOME inherited from another environment', () => {
		const python = venv('.venv');
		const other = join(dir, 'other');
		const env = activatedEnv(python, {
			PATH: [join(other, BIN), 'C:\\Windows'].join(delimiter),
			VIRTUAL_ENV: other,
			PYTHONHOME: 'C:\\Python39',
			CONDA_PREFIX: 'C:\\miniconda3',
			CONDA_DEFAULT_ENV: 'base',
		});
		expect(env['VIRTUAL_ENV']).toBe(join(dir, '.venv'));
		expect(env).not.toHaveProperty('PYTHONHOME');
		expect(env).not.toHaveProperty('CONDA_PREFIX');
		expect(env).not.toHaveProperty('CONDA_DEFAULT_ENV');
		// The stale venv's Scripts folder no longer shadows anything; the rest of PATH stays.
		expect(env['PATH']?.split(delimiter)).toEqual([join(dir, '.venv', BIN), 'C:\\Windows']);
	});

	it('keeps variables that describe the chosen env, whatever their casing', () => {
		const python = venv('.venv');
		const env = activatedEnv(python, { Path: 'C:\\Windows', VIRTUAL_ENV: join(dir, '.venv') });
		expect(env['VIRTUAL_ENV']).toBe(join(dir, '.venv'));
		// Windows: one PATH, under the casing it already had (a second one would be ambiguous).
		if (WIN)
			expect(Object.keys(env).filter((k) => k.toLowerCase() === 'path')).toEqual(['Path']);
	});

	it('activates a named conda env like `conda activate`', () => {
		const envDir = join(dir, 'miniconda3', 'envs', 'quant');
		const python = conda(envDir);
		const env = activatedEnv(python, { PATH: 'C:\\Windows', VIRTUAL_ENV: join(dir, 'x') });
		expect(env['CONDA_PREFIX']).toBe(envDir);
		expect(env['CONDA_DEFAULT_ENV']).toBe('quant');
		expect(env).not.toHaveProperty('VIRTUAL_ENV');
		const expected = WIN
			? [
					envDir,
					join(envDir, 'Library', 'mingw-w64', 'bin'),
					join(envDir, 'Library', 'usr', 'bin'),
					join(envDir, 'Library', 'bin'),
					join(envDir, 'Scripts'),
					join(envDir, 'bin'),
					'C:\\Windows',
				]
			: [join(envDir, 'bin'), 'C:\\Windows'];
		expect(env['PATH']?.split(delimiter)).toEqual(expected);
	});

	it('names the root install base', () => {
		const root = join(dir, 'miniconda3');
		const python = conda(root);
		mkdirSync(join(root, 'condabin'));
		expect(activatedEnv(python, {})['CONDA_DEFAULT_ENV']).toBe('base');
	});
});
