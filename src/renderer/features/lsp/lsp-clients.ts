import type { MonacoLanguageClient } from 'monaco-languageclient';
import type { CloseAction, ErrorAction } from 'vscode-languageclient/browser';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { ipcTransports } from './ipc-transport';
import { LANGUAGE_LABEL, useLspStatus } from './lsp-status';

interface Running {
	client: MonacoLanguageClient;
	session: string;
}

// ErrorAction.Continue / CloseAction.DoNotRestart from vscode-languageclient. Inlined: its
// './browser' entry only resolves under the browser condition, and unit tests import this module
// in Node.
const ERROR_CONTINUE = 1 as ErrorAction.Continue;
const CLOSE_DO_NOT_RESTART = 1 as CloseAction.DoNotRestart;

/** A server that is running but never answers initialize must not leave the status pulsing. */
const START_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const clients = new Map<LspLanguage, Running>();
const starting = new Map<LspLanguage, Promise<void>>();
// Bumped on stopAll so a start that was in flight when the folder changed is thrown away.
let generation = 0;

async function start(language: LspLanguage): Promise<void> {
	const gen = generation;
	const status = useLspStatus.getState();
	status.set(language, 'starting');
	try {
		// Loaded on first use: the client library pulls in the vscode API shims (~0.5 MB).
		const [{ MonacoLanguageClient }, vscode] = await Promise.all([
			import('monaco-languageclient'),
			import('vscode'),
		]);
		const info = await call('lsp:start', { language });
		if (gen !== generation) {
			await call('lsp:stop', { session: info.session });
			return;
		}
		const client = new MonacoLanguageClient({
			name: `Anvil ${LANGUAGE_LABEL[language]}`,
			clientOptions: {
				documentSelector: info.languageIds.map((id) => ({ scheme: 'file', language: id })),
				workspaceFolder: {
					uri: vscode.Uri.parse(info.rootUri),
					name: info.rootUri.split('/').pop() ?? 'workspace',
					index: 0,
				},
				initializationOptions: info.initializationOptions,
				errorHandler: {
					error: () => ({ action: ERROR_CONTINUE }),
					closed: () => {
						// The server died (crash, killed): report it; the user restarts from the status bar.
						if (clients.get(language)?.session === info.session) {
							clients.delete(language);
							useLspStatus
								.getState()
								.set(language, 'error', 'The language server stopped');
						}
						return { action: CLOSE_DO_NOT_RESTART };
					},
				},
			},
			messageTransports: ipcTransports(info.session),
		});
		try {
			await withTimeout(
				client.start(),
				START_TIMEOUT_MS,
				`The ${LANGUAGE_LABEL[language]} language server did not respond within ${START_TIMEOUT_MS / 1000} s`,
			);
		} catch (error) {
			// Don't leave a half-started client or a server process behind.
			void client
				.dispose()
				.catch((e: unknown) => rlog.warn('lsp', 'client dispose failed', e));
			void call('lsp:stop', { session: info.session }).catch((e: unknown) =>
				rlog.warn('lsp', 'stop after failed start failed', e),
			);
			throw error;
		}
		if (gen !== generation) {
			await client.dispose();
			return;
		}
		clients.set(language, { client, session: info.session });
		status.set(language, 'ready');
	} catch (error) {
		rlog.error('lsp', `${language} server failed to start`, error);
		useLspStatus
			.getState()
			.set(language, 'error', error instanceof Error ? error.message : String(error));
	}
}

/** Starts the server for `language` unless it's already running or starting. */
export function ensureClient(language: LspLanguage): Promise<void> {
	if (clients.has(language)) return Promise.resolve();
	const pending = starting.get(language);
	if (pending) return pending;
	const promise = start(language).finally(() => starting.delete(language));
	starting.set(language, promise);
	return promise;
}

export async function stopAll(): Promise<void> {
	generation += 1;
	const running = [...clients.values()];
	clients.clear();
	useLspStatus.getState().reset();
	await Promise.all(
		running.map(async ({ client, session }) => {
			try {
				await client.dispose();
			} catch (error) {
				rlog.warn('lsp', 'client dispose failed', error);
			}
			await call('lsp:stop', { session }).catch(() => undefined);
		}),
	);
}

export async function restart(languages: LspLanguage[]): Promise<void> {
	await stopAll();
	await Promise.all(languages.map(ensureClient));
}
