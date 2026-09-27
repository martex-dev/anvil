import { describe, expect, it, vi } from 'vitest';

import type { PythonEnv } from '@shared/ipc/channels/python';

// run.ts pulls in Monaco-facing editor code; only the pure check is under test here.
vi.mock('./run', () => ({ restartRepl: vi.fn() }));
vi.mock('../terminal/terminal-store', () => ({ hasRole: vi.fn() }));

const { replOutdated } = await import('./repl-notice');

const env = (path: string): PythonEnv => ({
	path,
	label: path,
	kind: 'venv',
	version: '3.12.1',
	local: true,
});

describe('replOutdated', () => {
	it('flags an open REPL when the interpreter really changed', () => {
		expect(
			replOutdated(env('C:\\p\\.venv\\python.exe'), env('C:\\py312\\python.exe'), true),
		).toBe(true);
		expect(replOutdated(env('C:\\p\\.venv\\python.exe'), null, true)).toBe(true);
		expect(replOutdated(null, env('C:\\p\\.venv\\python.exe'), true)).toBe(true);
	});

	it('stays quiet without a REPL, on the first report, or for the same interpreter', () => {
		const a = env('C:\\p\\.venv\\python.exe');
		expect(replOutdated(a, env('C:\\py\\python.exe'), false)).toBe(false);
		expect(replOutdated(undefined, a, true)).toBe(false);
		expect(replOutdated(a, env('c:\\P\\.venv\\python.exe'), true)).toBe(false);
		expect(replOutdated(null, null, true)).toBe(false);
	});
});
