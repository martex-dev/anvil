import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { externalEnvs, isStorePython, parseEnvsDirs } from './env-sources';
import { interpreterExists, interpreterIn } from './envs';

const WIN = process.platform === 'win32';

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), 'anvil-home-'));
	vi.stubEnv('USERPROFILE', home);
	vi.stubEnv('HOME', home);
	vi.stubEnv('APPDATA', join(home, 'AppData', 'Roaming'));
	for (const name of ['PYENV_ROOT', 'POETRY_VIRTUALENVS_PATH', 'WORKON_HOME'])
		vi.stubEnv(name, undefined);
});
afterEach(() => {
	vi.unstubAllEnvs();
	rmSync(home, { recursive: true, force: true });
});

/** A minimal environment folder with its interpreter where interpreterIn looks for it. */
function env(dir: string): string {
	const python = WIN ? join(dir, 'python.exe') : join(dir, 'bin', 'python3');
	mkdirSync(join(python, '..'), { recursive: true });
	writeFileSync(python, '');
	return python;
}

describe('parseEnvsDirs', () => {
	it('reads block and flow lists and expands ~', () => {
		const rc =
			'channels:\n  - conda-forge\nenvs_dirs:\n  - ~/envs\n  # comment\n  - "D:\\conda envs"\nauto_activate_base: false\n';
		expect(parseEnvsDirs(rc, 'H')).toEqual([join('H', 'envs'), 'D:\\conda envs']);
		expect(parseEnvsDirs('envs_dirs: [~/a, /opt/b]\n', 'H')).toEqual([
			join('H', 'a'),
			'/opt/b',
		]);
		expect(parseEnvsDirs('channels: []\n')).toEqual([]);
	});
});

describe('externalEnvs', () => {
	it('finds ~/.conda/envs, .condarc envs_dirs, pyenv, poetry and pipenv envs', async () => {
		const conda = env(join(home, '.conda', 'envs', 'research'));
		const custom = env(join(home, 'my-envs', 'ml'));
		writeFileSync(join(home, '.condarc'), 'envs_dirs:\n  - ~/my-envs\n');
		const pyenvRoot = join(home, '.pyenv', ...(WIN ? ['pyenv-win'] : []));
		const pyenv = env(join(pyenvRoot, 'versions', '3.11.9'));
		const poetryDir = WIN
			? join(home, 'AppData', 'Roaming', 'pypoetry', 'virtualenvs')
			: join(
					home,
					process.platform === 'darwin' ? 'Library/Caches' : '.cache',
					'pypoetry',
					'virtualenvs',
				);
		const poetry = env(join(poetryDir, 'bot-x1y2-py3.12'));
		const pipenv = env(join(home, '.virtualenvs', 'site-a1b2'));

		const found = await externalEnvs([], interpreterIn);
		expect(found).toEqual(
			expect.arrayContaining([
				{ path: conda, kind: 'conda', label: 'conda: research', local: false },
				{ path: custom, kind: 'conda', label: 'conda: ml', local: false },
				{ path: pyenv, kind: 'system', label: 'pyenv: 3.11.9', local: false },
				{ path: poetry, kind: 'venv', label: 'poetry: bot-x1y2-py3.12', local: false },
				{ path: pipenv, kind: 'venv', label: 'pipenv: site-a1b2', local: false },
			]),
		);
		expect(found).toHaveLength(5);
	});

	it('finds nothing, quietly, when none of the tools is installed', async () => {
		expect(await externalEnvs([], interpreterIn)).toEqual([]);
	});
});

describe('Microsoft Store Pythons', () => {
	const apps = 'C:\\Users\\m\\AppData\\Local\\Microsoft\\WindowsApps';

	it('accepts the per-version aliases but not the bare installer stub', () => {
		expect(
			isStorePython(
				`${apps}\\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\\python.exe`,
			),
		).toBe(true);
		expect(isStorePython(`${apps}\\python.exe`)).toBe(false);
		expect(isStorePython(`${apps}\\python3.exe`)).toBe(false);
	});

	it('treats a missing interpreter as missing', () => {
		expect(interpreterExists(join(home, 'nope', 'python.exe'))).toBe(false);
		expect(interpreterExists(env(join(home, 'venv')))).toBe(true);
	});
});
