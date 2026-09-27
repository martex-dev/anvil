import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { AnvilError, errorMessage } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { activatedEnv, interpreter } from '../python/interpreter';
import { DapSession } from './dap-session';
import { envInfo, hasDebugpy, installCommand } from './env-info';
import { launchConfig, targetLabel } from './launch';
import { terminalCommand } from './shell-command';

/** The folder's real path; the folder itself if it can't be resolved (it was just deleted). */
function realRoot(root: string): string {
	try {
		return realpathSync.native(root);
	} catch {
		return root;
	}
}

/**
 * Python debugging through debugpy's Debug Adapter Protocol server, run from the selected
 * interpreter (ADR-004: Anvil ships no Python, so debugpy comes from the user's env).
 */
export const debugFeature: MainFeature = {
	id: 'debug',
	activate(ctx) {
		const sessions = new Map<string, DapSession>();

		const stop = async (id: string): Promise<void> => {
			const session = sessions.get(id);
			sessions.delete(id);
			await session?.dispose();
		};
		const stopAll = async (): Promise<void> => {
			await Promise.all([...sessions.keys()].map(stop));
		};
		ctx.onDispose(stopAll);
		// A session belongs to the folder it was started in.
		ctx.workspace.onChange(() => void stopAll());

		ctx.ipc.handle('debug:start', async ({ target, justMyCode }) => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('DEBUG_NO_FOLDER', 'Open a folder to debug its code');
			const python = interpreter.resolve(root);
			if (!python)
				throw new AnvilError(
					'DEBUG_NO_PYTHON',
					'No Python interpreter found. Install Python or create a venv (uv venv).',
				);
			// Validates the target (inside the folder, file exists) before anything is spawned.
			const launchArgs = launchConfig(target, { root, python, justMyCode });
			if (!(await hasDebugpy(python))) {
				const env = envInfo(python, root);
				return {
					status: 'missing' as const,
					python,
					env: env.label,
					installCommand: installCommand(python, env.uv),
				};
			}
			// One debug session at a time, like the toolbar shows.
			await stopAll();
			const id = randomUUID();
			const session = new DapSession(
				id,
				// Not the project folder as cwd: Windows would lock it while the adapter runs.
				{ python, env: activatedEnv(python), cwd: tmpdir() },
				launchArgs,
				{
					message: (message) => ctx.emit('debug:message', { session: id, message }),
					runInTerminal: (seq, args, title) => {
						try {
							ctx.emit('debug:runInTerminal', {
								session: id,
								seq,
								title: title || targetLabel(target),
								command: terminalCommand(args),
							});
						} catch (error) {
							ctx.log.warn('runInTerminal refused', { error: errorMessage(error) });
							session.reply(seq, 'runInTerminal', errorMessage(error));
						}
					},
					exit: (code, stderr) => {
						if (sessions.get(id) === session && code !== 0)
							ctx.log.warn('debug adapter exited', {
								code,
								stderr: stderr.slice(-500),
							});
						if (sessions.get(id) === session) sessions.delete(id);
						ctx.emit('debug:exit', { session: id, code, stderr });
					},
				},
			);
			sessions.set(id, session);
			ctx.log.info('debug adapter started', { target: target.kind, pid: session.pid });
			return { status: 'started' as const, session: id, python, root: realRoot(root) };
		});

		ctx.ipc.handle('debug:send', ({ session, message }) => {
			const target = sessions.get(session);
			if (!target) throw new AnvilError('DEBUG_NO_SESSION', 'The debugger is not running');
			try {
				target.send(message);
			} catch (error) {
				throw new AnvilError('DEBUG_REFUSED', errorMessage(error));
			}
		});
		ctx.ipc.handle('debug:stop', ({ session }) => stop(session));
	},
};
