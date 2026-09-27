import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envInfo, installCommand } from './env-info';
import { launchConfig, targetLabel } from './launch';
import { terminalCommand } from './shell-command';

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-debug-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('terminal command for runInTerminal', () => {
	it('quotes every argument for PowerShell and sets the folder and env first', () => {
		const line = terminalCommand(
			{
				args: ['C:\\Py 3\\python.exe', 'C:\\x\\launcher', '5678', '--', "it's.py"],
				env: { DEBUGPY_LOG_DIR: 'C:\\logs', GONE: null, 'BAD NAME': 'x' },
				cwd: 'C:\\My Project',
			},
			'win32',
		);
		expect(line).toBe(
			"Set-Location -LiteralPath 'C:\\My Project'; $env:DEBUGPY_LOG_DIR='C:\\logs'; " +
				'Remove-Item Env:GONE -ErrorAction SilentlyContinue; ' +
				"& 'C:\\Py 3\\python.exe' 'C:\\x\\launcher' '5678' '--' 'it''s.py'",
		);
	});

	it('builds a POSIX line elsewhere', () => {
		expect(
			terminalCommand(
				{ args: ['/usr/bin/python3', 'main.py'], env: { A: '1', B: null }, cwd: '/p' },
				'linux',
			),
		).toBe("cd -- '/p' && unset B; A='1' '/usr/bin/python3' 'main.py'");
	});

	it('refuses line breaks, which would run half a command', () => {
		expect(() => terminalCommand({ args: ['python', 'a\nb'] }, 'win32')).toThrow(/line break/);
		expect(() => terminalCommand({ args: [] }, 'win32')).toThrow();
	});
});

describe('launch configuration', () => {
	const ctx = (): { root: string; python: string; justMyCode: boolean } => ({
		root: dir,
		python: 'C:\\py\\python.exe',
		justMyCode: true,
	});

	it('debugs a file inside the folder with the interpreter main picked', () => {
		mkdirSync(join(dir, 'src'));
		writeFileSync(join(dir, 'src', 'main.py'), 'print(1)\n');
		const config = launchConfig({ kind: 'file', path: 'src/main.py' }, ctx());
		expect(config).toMatchObject({
			request: 'launch',
			program: join(dir, 'src', 'main.py'),
			python: 'C:\\py\\python.exe',
			cwd: dir,
			console: 'integratedTerminal',
			justMyCode: true,
		});
	});

	it('refuses paths outside the folder and missing files', () => {
		expect(() => launchConfig({ kind: 'file', path: '../evil.py' }, ctx())).toThrow(/outside/);
		expect(() => launchConfig({ kind: 'file', path: 'nope.py' }, ctx())).toThrow(/not found/);
	});

	it('runs modules and pytest node ids from the folder', () => {
		expect(launchConfig({ kind: 'module', module: 'pkg.cli' }, ctx())).toMatchObject({
			module: 'pkg.cli',
		});
		mkdirSync(join(dir, 'tests'));
		writeFileSync(join(dir, 'tests', 'test_a.py'), 'def test_x(): pass\n');
		const target = { kind: 'pytest', path: 'tests/test_a.py', test: 'TestA::test_x' } as const;
		expect(launchConfig(target, ctx())).toMatchObject({
			module: 'pytest',
			args: ['tests/test_a.py::TestA::test_x', '-q'],
		});
		expect(targetLabel(target)).toBe('test_x');
	});
});

describe('environment for the debugpy prompt', () => {
	it('names a local venv and spots uv-made ones', () => {
		const env = join(dir, '.venv');
		mkdirSync(join(env, 'Scripts'), { recursive: true });
		writeFileSync(join(env, 'pyvenv.cfg'), 'home = C:\\py\nuv = 0.5.1\nversion_info = 3.12\n');
		const info = envInfo(join(env, 'Scripts', 'python.exe'), dir);
		expect(info).toEqual({ label: '.venv', uv: true });
		expect(installCommand('C:\\a b\\python.exe', true, 'win32')).toBe(
			"uv pip install --python 'C:\\a b\\python.exe' debugpy",
		);
	});

	it('uses pip for other envs and names conda ones', () => {
		const conda = join(dir, 'envs', 'research');
		mkdirSync(join(conda, 'conda-meta'), { recursive: true });
		expect(envInfo(join(conda, 'python.exe'), null)).toEqual({
			label: 'conda: research',
			uv: false,
		});
		expect(installCommand('C:\\py\\python.exe', false, 'win32')).toBe(
			"& 'C:\\py\\python.exe' -m pip install debugpy",
		);
	});
});
