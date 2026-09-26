import { execFile } from 'node:child_process';
import { homedir } from 'node:os';

import { spawn } from 'node-pty';

import type { TerminalPresetId } from '@shared/ipc/channels/terminal';

import type { MainFeature } from '../../core/features';
import { activatedEnv, interpreter } from '../python/interpreter';
import { launchSpec, listPresets } from './presets';
import { type SpawnPty, TerminalSessions } from './terminal-sessions';

const spawnPty: SpawnPty = (spec, { cwd, cols, rows }) =>
	spawn(spec.file, spec.args, {
		name: 'xterm-256color',
		cwd,
		cols,
		rows,
		env: { ...process.env, ...spec.env } as Record<string, string>,
		// ConPTY is the modern Windows console backend (Windows 10 1809+).
		useConpty: true,
	});

function hasIPython(python: string): Promise<boolean> {
	return new Promise((resolve) => {
		execFile(
			python,
			['-c', 'import IPython'],
			{ env: activatedEnv(python), windowsHide: true, timeout: 10_000 },
			(error) => resolve(!error),
		);
	});
}

export const terminalFeature: MainFeature = {
	id: 'terminal',
	activate(ctx) {
		const live = new TerminalSessions(spawnPty, {
			onData: (sessionId, data) => ctx.emit('terminal:data', { sessionId, data }),
			onExit: (sessionId, exitCode) => ctx.emit('terminal:exit', { sessionId, exitCode }),
		});
		const cwd = (): string => ctx.workspace.root() ?? homedir();
		const python = (): string | null => interpreter.resolve(ctx.workspace.root());

		const startSession = async (
			sessionId: string,
			preset: TerminalPresetId,
			cols: number,
			rows: number,
		): Promise<void> => {
			const py = python();
			const ipython = preset === 'repl' && py ? await hasIPython(py) : false;
			const spec = await launchSpec(preset, py, ipython);
			live.start(sessionId, preset, spec, cwd(), cols, rows);
			ctx.log.info('terminal started', { preset, cwd: cwd() });
		};

		ctx.ipc.handle('terminal:presets', () => listPresets(python()));
		ctx.ipc.handle(
			'terminal:open',
			async ({ sessionId, preset, cols, rows, initialCommand }) => {
				const fresh = !live.has(sessionId);
				if (fresh) await startSession(sessionId, preset, cols, rows);
				else live.resize(sessionId, cols, rows);
				// Only into a session this call started: reattaching (a font-size change or StrictMode
				// remounts the pane) must not run the file or task again.
				// ConPTY buffers input typed before the shell's first prompt, so this is safe to send now.
				if (initialCommand && fresh) live.write(sessionId, `${initialCommand}\r`);
				const s = live.get(sessionId);
				return {
					sessionId,
					title: s?.title ?? preset,
					cwd: s?.cwd ?? cwd(),
					backlog: fresh ? '' : (s?.backlog ?? ''),
					running: Boolean(s?.pty),
				};
			},
		);
		ctx.ipc.handle('terminal:write', async ({ sessionId, data, restart }) => {
			const s = live.get(sessionId);
			// Run / REPL / task commands restart a shell that has exited instead of vanishing.
			if (restart && s && !s.pty) await startSession(sessionId, s.preset, s.cols, s.rows);
			return live.write(sessionId, data);
		});
		ctx.ipc.handle('terminal:resize', ({ sessionId, cols, rows }) =>
			live.resize(sessionId, cols, rows),
		);
		ctx.ipc.handle('terminal:restart', async ({ sessionId, cols, rows }) => {
			const s = live.get(sessionId);
			if (!s || s.pty) return;
			await startSession(sessionId, s.preset, cols, rows);
		});
		ctx.ipc.handle('terminal:kill', (sessionId) => live.kill(sessionId));

		// Quitting must not leave shells running.
		ctx.onDispose(() => live.killAll());
	},
};
