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
// Bumped per language when its server is stopped, so a start still in flight is thrown away
// instead of registering a client for the old folder or interpreter.
const generations: Record<LspLanguage, number> = { python: 0, typescript: 0 };

/** Disposes a client, releasing its IPC listeners; failures are logged, never thrown. */
async function disposeClient(client: MonacoLanguageClient): Promise<void> {
	try {
		await client.dispose();
	} catch (error) {
		rlog.warn('lsp', 'client dispose failed', error);
	}
}

/** Ends a server process in main; failures are logged, never thrown. */
async function stopSession(session: string): Promise<void> {
	await call('lsp:stop', { session }).catch((error: unknown) =>
		rlog.warn('lsp', 'language server stop failed', error),
	);
}

/** Lets a running client shut its server down cleanly, then makes sure the process is gone. */
async function shutdown(client: MonacoLanguageClient, session: string): Promise<void> {
	await disposeClient(client);
	await stopSession(session);
}

async function start(language: LspLanguage): Promise<void> {
	const gen = generations[language];
	const current = (): boolean => gen === generations[language];
	const status = useLspStatus.getState();
	status.set(language, 'starting');
	let session: string | null = null;
	let client: MonacoLanguageClient | null = null;
	try {
		// Loaded on first use: the client library pulls in the vscode API shims (~0.5 MB).
		const [{ MonacoLanguageClient }, vscode] = await Promise.all([
			import('monaco-languageclient'),
			import('vscode'),
		]);
		const info = await call('lsp:start', { language });
		session = info.session;
		if (!current()) {
			await stopSession(info.session);
			return;
		}
		const created: MonacoLanguageClient = new MonacoLanguageClient({
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
							// Release the transport's IPC listeners. Deferred: disposing from inside the
							// client's own close callback would re-enter it.
							setTimeout(() => void shutdown(created, info.session), 0);
						}
						return { action: CLOSE_DO_NOT_RESTART };
					},
				},
			},
			messageTransports: ipcTransports(info.session),
		});
		client = created;
		await withTimeout(
			created.start(),
			START_TIMEOUT_MS,
			`The ${LANGUAGE_LABEL[language]} language server did not respond within ${START_TIMEOUT_MS / 1000} s`,
		);
		if (!current()) {
			await shutdown(created, info.session);
			return;
		}
		clients.set(language, { client: created, session: info.session });
		status.set(language, 'ready', info.notice);
	} catch (error) {
		// Don't leave a half-started client, its IPC listeners or a server process behind. Not
		// awaited, and not in sequence: disposing a client whose start never finished can hang.
		if (client) void disposeClient(client);
		if (session) void stopSession(session);
		rlog.error('lsp', `${language} server failed to start`, error);
		// A start superseded by a stop or restart no longer owns the status.
		if (!current()) return;
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
	const promise = start(language).finally(() => {
		// A stop may have replaced this entry with a fresh start already.
		if (starting.get(language) === promise) starting.delete(language);
	});
	starting.set(language, promise);
	return promise;
}

/** Stops one language's server (running or still starting) and leaves the others alone. */
async function stopLanguage(language: LspLanguage): Promise<void> {
	generations[language] += 1;
	// Forget the in-flight start so the next ensureClient starts afresh instead of joining a start
	// that will throw itself away.
	starting.delete(language);
	const running = clients.get(language);
	clients.delete(language);
	useLspStatus.getState().set(language, 'idle');
	if (running) await shutdown(running.client, running.session);
}

const LANGUAGES = Object.keys(generations) as LspLanguage[];

/** Stops every server, e.g. when the folder changes. */
export async function stopAll(): Promise<void> {
	await Promise.all(LANGUAGES.map(stopLanguage));
}

/** Restarts only `languages`; the other servers keep running. */
export async function restart(languages: LspLanguage[]): Promise<void> {
	await Promise.all(languages.map(stopLanguage));
	await Promise.all(languages.map(ensureClient));
}
