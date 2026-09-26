import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LspSession } from './lsp-session';
import type { ServerLaunch } from './servers';

let dir: string;
beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-lsp-err-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function fakeServer(source: string): ServerLaunch {
	const script = join(dir, `server-${Math.random().toString(36).slice(2)}.js`);
	writeFileSync(script, source);
	return { script, args: [], env: process.env, languageIds: [], initializationOptions: {} };
}

function waitForExit(
	start: (exit: (code: number | null, stderr: string) => void) => LspSession,
): Promise<{ session: LspSession; code: number | null; stderr: string }> {
	return new Promise((resolve) => {
		const session: LspSession = start((code, stderr) => resolve({ session, code, stderr }));
	});
}

describe('LspSession failure handling', () => {
	it('survives writes to a server whose stdin pipe already closed', async () => {
		// The server closes its end of stdin (as a crashing process does) but lingers briefly,
		// so our writes hit a broken pipe before 'exit' arrives.
		const launch = fakeServer('process.stdin.destroy(); setTimeout(() => {}, 400);');
		const result = await waitForExit((exit) => {
			const session = new LspSession('pipe', launch, dir, { message: () => undefined, exit });
			const big = { jsonrpc: '2.0', method: 'x', params: 'y'.repeat(256 * 1024) };
			const timer = setInterval(() => session.send(big), 20);
			setTimeout(() => clearInterval(timer), 300);
			return session;
		});
		expect(result.code).toBe(0);
	});
});
