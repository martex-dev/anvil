import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LspSession } from './lsp-session';
import { type LspLanguage, serverLaunch } from './servers';

interface Rpc {
	id?: number;
	method?: string;
	params?: unknown;
	result?: unknown;
}

let root: string;
beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), 'anvil-lsp-'));
	writeFileSync(
		join(root, 'main.py'),
		'def add(a: int, b: int) -> int:\n    return a + b\n\nadd("x", 1)\n',
	);
	writeFileSync(join(root, 'main.ts'), 'export const n: number = 1;\n');
});
afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }));

/** Starts a real server and returns helpers to talk to it. */
function start(language: LspLanguage): {
	session: LspSession;
	request: (method: string, params: unknown) => Promise<Rpc>;
	notify: (method: string, params: unknown) => void;
	waitFor: (method: string, match?: (m: Rpc) => boolean) => Promise<Rpc>;
} {
	const received: Rpc[] = [];
	const waiters: Array<() => void> = [];
	const launch = serverLaunch(language, root);
	// Neutral cwd, as in production: Windows locks a process's cwd, which broke cleanup here.
	const session = new LspSession(`test-${language}`, launch, tmpdir(), {
		message: (m) => {
			const msg = m as Rpc;
			// Answer server → client requests the way a minimal client would.
			if (msg.method && msg.id !== undefined) {
				const items = (msg.params as { items?: unknown[] } | undefined)?.items;
				const result =
					msg.method === 'workspace/configuration' ? (items ?? []).map(() => null) : null;
				session.send({ jsonrpc: '2.0', id: msg.id, result });
			}
			received.push(msg);
			for (const w of waiters.splice(0)) w();
		},
		exit: () => undefined,
	});
	let nextId = 1;
	const find = async (match: (m: Rpc) => boolean): Promise<Rpc> => {
		for (;;) {
			const hit = received.find(match);
			if (hit) return hit;
			await new Promise<void>((resolve) => waiters.push(resolve));
		}
	};
	return {
		session,
		request: (method, params) => {
			const id = nextId++;
			session.send({ jsonrpc: '2.0', id, method, params });
			return find((m) => m.id === id && m.method === undefined);
		},
		notify: (method, params) => session.send({ jsonrpc: '2.0', method, params }),
		waitFor: (method, match = () => true) => find((m) => m.method === method && match(m)),
	};
}

const initParams = (): unknown => ({
	processId: process.pid,
	rootUri: pathToFileURL(root).href,
	workspaceFolders: [{ uri: pathToFileURL(root).href, name: 'test' }],
	capabilities: { textDocument: { publishDiagnostics: {}, hover: {} } },
});

describe('language servers (real processes)', () => {
	it('basedpyright initializes and reports a type error', async () => {
		const s = start('python');
		try {
			const init = await s.request('initialize', initParams());
			expect(
				(init.result as { capabilities: { hoverProvider?: unknown } }).capabilities
					.hoverProvider,
			).toBeTruthy();
			s.notify('initialized', {});
			s.notify('textDocument/didOpen', {
				textDocument: {
					uri: pathToFileURL(join(root, 'main.py')).href,
					languageId: 'python',
					version: 1,
					text: 'def add(a: int, b: int) -> int:\n    return a + b\n\nadd("x", 1)\n',
				},
			});
			type Published = { diagnostics: Array<{ message: string }> };
			// The first publish can be an empty list while checking; wait for real results.
			const diagnostics = await s.waitFor(
				'textDocument/publishDiagnostics',
				(m) => (m.params as Published).diagnostics.length > 0,
			);
			const list = (diagnostics.params as Published).diagnostics;
			expect(list.some((d) => /cannot be assigned to parameter "a"/.test(d.message))).toBe(
				true,
			);
		} finally {
			await s.session.dispose();
		}
	}, 60_000);

	it('typescript-language-server initializes with a tsserver', async () => {
		const s = start('typescript');
		try {
			const init = await s.request('initialize', {
				...(initParams() as object),
				initializationOptions: serverLaunch('typescript', root).initializationOptions,
			});
			const caps = (init.result as { capabilities: Record<string, unknown> }).capabilities;
			expect(caps['definitionProvider']).toBeTruthy();
			expect(caps['renameProvider']).toBeTruthy();
		} finally {
			await s.session.dispose();
		}
	}, 60_000);
});
