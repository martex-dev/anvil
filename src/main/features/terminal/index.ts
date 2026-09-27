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
		env: spec.env,
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

/** Same folder (case-insensitive on Windows); null is no folder. */
function sameFolder(a: string | null, b: string | null): boolean {
	if (a === null || b === null) return a === b;
	return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export const terminalFeature: MainFeature = {
	id: 'terminal',
	activate(ctx) {
		const live = new TerminalSessions(spawnPty, {
			onData: (sessionId, data, seq) => ctx.emit('terminal:data', { sessionId, data, seq }),
			onExit: (sessionId, exitCode, reason) =>
				ctx.emit('terminal:exit', { sessionId, exitCode, ...(reason ? { reason } : {}) }),
		});
		const cwd = (): string => ctx.workspace.root() ?? homedir();
		const python = (): string | null => interpreter.resolve(ctx.workspace.root());

		const startSession = async (
			sessionId: string,
			preset: TerminalPresetId,
			cols: number,
			rows: number,
			role: string | null,
		): Promise<void> => {
			const py = python();
			const ipython = preset === 'repl' && py ? await hasIPython(py) : false;
			const spec = await launchSpec(preset, py, ipython);
			live.start(sessionId, preset, spec, cwd(), cols, rows, { role, python: py });
			ctx.log.info('terminal started', { preset, cwd: cwd() });
		};

		// Every shell's cwd is the old folder (Windows then won't let it be renamed or deleted)
		// and its env was built for it: end them, as VS Code does when the folder changes.
		let root = ctx.workspace.root();
		ctx.workspace.onChange((next) => {
			if (sameFolder(root, next)) return;
			root = next;
			live.stopAll('The folder changed — press Enter to restart');
		});

		ctx.ipc.handle('terminal:presets', () => listPresets(python()));
		ctx.ipc.handle(
			'terminal:open',
			async ({ sessionId, preset, cols, rows, initialCommand, role }) => {
				const fresh = await live.ensure(sessionId, () =>
					startSession(sessionId, preset, cols, rows, role ?? null),
				);
				if (!fresh) live.resize(sessionId, cols, rows);
				// Only into a session this call started: reattaching (a reloaded window or StrictMode
				// remounts the pane) must not run the file or task again.
				// ConPTY buffers input typed before the shell's first prompt, so this is safe to send now.
				if (initialCommand && fresh) live.write(sessionId, `${initialCommand}\r`);
				const s = live.get(sessionId);
				// Always the snapshot, even for a fresh session: its first output may already have
				// gone out as events the pane holds until this reply, and seq tells which.
				const { backlog, seq } = live.snapshot(sessionId);
				return {
					sessionId,
					title: s?.title ?? preset,
					cwd: s?.cwd ?? cwd(),
					backlog,
					seq,
					running: Boolean(s?.pty),
				};
			},
		);
		ctx.ipc.handle('terminal:write', async ({ sessionId, data, restart }) => {
			if (restart) {
				// A pane that just mounted may still be starting this session: write once it's up.
				await live.settled(sessionId);
				const s = live.get(sessionId);
				// A Run / REPL / task terminal keeps the interpreter (and PATH) it started with. The
				// next command sent to it restarts it with the current one; stopping it the moment
				// the interpreter changed could kill a task mid-run (`uv sync` creates .venv).
				if (s?.pty && s.role !== null && s.python !== python())
					live.stop(sessionId, 'Restarting with the selected Python interpreter');
				// Run / REPL / task commands restart a shell that has exited instead of vanishing.
				if (s)
					await live.relaunch(sessionId, () =>
						startSession(sessionId, s.preset, s.cols, s.rows, s.role),
					);
			}
			return live.write(sessionId, data);
		});
		ctx.ipc.handle('terminal:resize', ({ sessionId, cols, rows }) =>
			live.resize(sessionId, cols, rows),
		);
		ctx.ipc.handle('terminal:restart', async ({ sessionId, preset, cols, rows, role }) => {
			const s = live.get(sessionId);
			// Gone from main: start it again rather than leave a pane that looks alive but isn't.
			if (!s) {
				await live.ensure(sessionId, () =>
					startSession(sessionId, preset, cols, rows, role ?? null),
				);
				return;
			}
			await live.relaunch(sessionId, () =>
				startSession(sessionId, s.preset, cols, rows, s.role),
			);
		});
		ctx.ipc.handle('terminal:kill', (sessionId) => live.kill(sessionId));

		// Quitting must not leave shells running.
		ctx.onDispose(() => live.killAll());
	},
};
