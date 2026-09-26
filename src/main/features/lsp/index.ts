import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { interpreter } from '../python/interpreter';
import { LspSession } from './lsp-session';
import { serverLaunch } from './servers';

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
			const launch = serverLaunch(language, root, interpreter.resolve(root));
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
			ctx.log.info('language server started', { language, pid: session.pid });
			return {
				session: id,
				rootUri: pathToFileURL(root).href,
				languageIds: launch.languageIds,
				initializationOptions: launch.initializationOptions,
			};
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
