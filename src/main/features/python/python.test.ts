import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { candidates, envDirOf, parsePyvenvVersion } from './envs';
import { cellCommand, moduleName, psQuote, REPL_STARTUP, stagedCode } from './index';
import { activatedEnv } from './interpreter';

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-py-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function fakeVenv(name: string): string {
	const bin = join(dir, name, process.platform === 'win32' ? 'Scripts' : 'bin');
	mkdirSync(bin, { recursive: true });
	const python = join(bin, process.platform === 'win32' ? 'python.exe' : 'python3');
	writeFileSync(python, '');
	writeFileSync(join(dir, name, 'pyvenv.cfg'), 'home = x\nversion = 3.12.4\n');
	return python;
}

describe('python envs', () => {
	it('parses venv and uv pyvenv.cfg versions', () => {
		expect(parsePyvenvVersion('home = C:\\py\nversion = 3.12.4\n')).toBe('3.12.4');
		expect(parsePyvenvVersion('version_info = 3.13.1.final.0')).toBe('3.13.1');
		expect(parsePyvenvVersion('nothing')).toBeNull();
	});

	it('finds the folder venv first and marks uv projects', () => {
		const python = fakeVenv('.venv');
		expect(candidates(dir)[0]).toMatchObject({ path: python, kind: 'venv', local: true });
		writeFileSync(join(dir, 'uv.lock'), '');
		expect(candidates(dir)[0]?.kind).toBe('uv');
	});

	it('maps an interpreter back to its environment folder', () => {
		const python = fakeVenv('venv');
		expect(envDirOf(python)).toBe(join(dir, 'venv'));
	});

	it('activates by environment: Scripts first on PATH and VIRTUAL_ENV set', () => {
		const python = fakeVenv('.venv');
		const env = activatedEnv(python, { PATH: 'C:\\Windows' });
		expect(env['VIRTUAL_ENV']).toBe(join(dir, '.venv'));
		expect(env['PATH']?.startsWith(join(dir, '.venv'))).toBe(true);
		expect(env['PATH']).toContain('C:\\Windows');
	});
});

describe('run helpers', () => {
	it('builds module names and quotes for PowerShell', () => {
		expect(moduleName('src/pkg/train.py')).toBe('src.pkg.train');
		expect(moduleName('pkg/__main__.py')).toBe('pkg');
		expect(psQuote("C:\\it's here\\a.py")).toBe("'C:\\it''s here\\a.py'");
	});

	it('runs staged cells through the short REPL helper', () => {
		expect(cellCommand(3)).toBe('_cell(3)');
		expect(REPL_STARTUP).toContain('def _cell(n):');
		expect(REPL_STARTUP).toContain("exec(compile(_code, _p, 'exec'), globals())");
		expect(REPL_STARTUP).toContain("'cell_%d.src' % n");
	});

	it('pads staged code so traceback lines match the source file', () => {
		expect(stagedCode('x = 1\ny = 2', 4)).toBe('\n\n\nx = 1\ny = 2');
		expect(stagedCode('x = 1', 1)).toBe('x = 1');
	});
});
