import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Envs from './envs';
import { interpreter } from './interpreter';

// No venv, conda or uv install on this "machine": only a python.org / PATH Python.
vi.mock('./envs', async (importOriginal) => ({
	...(await importOriginal<typeof Envs>()),
	candidates: () => [],
}));

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-interp-'));
});
afterEach(() => {
	interpreter.setSystem(null, []);
	rmSync(dir, { recursive: true, force: true });
});

describe('interpreter.resolve', () => {
	it('falls back to a discovered system Python and announces it once', () => {
		const python = join(dir, 'python.exe');
		writeFileSync(python, '');
		const listener = vi.fn();
		const off = interpreter.onChange(listener);
		expect(interpreter.resolve(null)).toBeNull();

		interpreter.setSystem(null, [python]);
		expect(interpreter.resolve(null)).toBe(python);
		expect(listener).toHaveBeenCalledTimes(1);

		// Rediscovering the same list changes nothing, so nobody restarts.
		interpreter.setSystem(null, [python]);
		expect(listener).toHaveBeenCalledTimes(1);
		off();
	});

	it('skips system entries that no longer exist', () => {
		const python = join(dir, 'python3');
		writeFileSync(python, '');
		interpreter.setSystem(null, [join(dir, 'gone'), python]);
		expect(interpreter.resolve(null)).toBe(python);
	});
});
