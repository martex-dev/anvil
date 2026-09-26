import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { interpreter } from '../python/interpreter';
import { LspSession } from './lsp-session';
import { serverLaunch, workspaceTsserver } from './servers';

const TrustSchema = z.boolean();

export const lspFeature: MainFeature = {
	id: 'lsp',
	activate(ctx) {
		const sessions = new Map<string, LspSession>();
		const byLanguage = new Map<LspLanguage, string>();

		const stop = async (id: string): Promise<void> => {
			const session = sessions.get(id);
			sessions.delete(id);
			for (const [language, current] of byLanguage) {
				if (current === id) byLanguage.delete(language);
			}
			await session?.dispose();
		};
		const stopAll = async (): Promise<void> => {
			await Promise.all([...sessions.keys()].map(stop));
		};

		const trustKey = (root: string): string => `workspaceTs:${root.toLowerCase()}`;
		const useWorkspaceTs = (root: string): boolean =>
			ctx.settings.get(trustKey(root), TrustSchema, false);
		const tsNotice = (root: string): string | null => {
			if (!workspaceTsserver(root)) return null;
			return useWorkspaceTs(root)
				? "Using this folder's TypeScript"
				: 'Using bundled TypeScript (run "Use Workspace TypeScript" to use this folder\'s)';
		};

		ctx.onDispose(stopAll);
		// Servers are per folder: switching folders makes them all stale.
		ctx.workspace.onChange(() => void stopAll());
		// A different interpreter means different site-packages: the renderer restarts Python.
		ctx.onDispose(
			interpreter.onChange(() => {
				const id = byLanguage.get('python');
				if (id) void stop(id);
			}),
		);

		ctx.ipc.handle('lsp:start', async ({ language }) => {
			const root = ctx.workspace.root();
			if (!root)
				throw new AnvilError('LSP_NO_FOLDER', 'Open a folder to use language features');
			// A renderer reload starts a new client, which must talk to a fresh (uninitialized) server.
			const previous = byLanguage.get(language);
			if (previous) await stop(previous);

			const id = randomUUID();
			const launch = serverLaunch(
				language,
				root,
				interpreter.resolve(root),
				process.env,
				language === 'typescript' && useWorkspaceTs(root),
			);
			// Not the project folder: Windows locks a process's cwd, so the user couldn't rename or
			// delete the folder while its server runs. Servers get the folder from rootUri anyway.
			const session = new LspSession(id, launch, tmpdir(), {
				message: (message) => ctx.emit('lsp:message', { session: id, message }),
				exit: (code, stderr) => {
					if (sessions.get(id) === session) {
						ctx.log.warn('language server exited', {
							language,
							code,
							stderr: stderr.slice(-500),
						});
					}
					sessions.delete(id);
					if (byLanguage.get(language) === id) byLanguage.delete(language);
					ctx.emit('lsp:exit', { session: id, code, stderr });
				},
			});
			sessions.set(id, session);
			byLanguage.set(language, id);
			try {
				await session.ready;
			} catch (error) {
				// The exit handler already dropped the session and logged the details.
				const code =
					error instanceof Error && 'code' in error && typeof error.code === 'string'
						? ` (${error.code})`
						: '';
				throw new AnvilError(
					'LSP_START_FAILED',
					`Could not start the ${language} language server${code}. See the log for details.`,
					error,
				);
			}
			ctx.log.info('language server started', { language, pid: session.pid });
			return {
				session: id,
				rootUri: pathToFileURL(root).href,
				languageIds: launch.languageIds,
				initializationOptions: launch.initializationOptions,
				notice: language === 'typescript' ? tsNotice(root) : null,
			};
		});
		ctx.ipc.handle('lsp:workspaceTs', () => {
			const root = ctx.workspace.root();
			return {
				available: root !== null && workspaceTsserver(root) !== null,
				enabled: root !== null && useWorkspaceTs(root),
			};
		});
		ctx.ipc.handle('lsp:setWorkspaceTs', ({ enabled }) => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('LSP_NO_FOLDER', 'Open a folder first');
			if (enabled && !workspaceTsserver(root))
				throw new AnvilError(
					'LSP_NO_WORKSPACE_TS',
					'This folder has no node_modules/typescript',
				);
			ctx.settings.set(trustKey(root), TrustSchema, enabled);
		});
		ctx.ipc.handle('lsp:send', ({ session, message }) => {
			const target = sessions.get(session);
			if (!target)
				throw new AnvilError('LSP_NO_SESSION', 'The language server is not running');
			target.send(message);
		});
		ctx.ipc.handle('lsp:stop', ({ session }) => stop(session));
	},
};
