import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { z } from 'zod';

import type { PythonEnv, PythonPackage, PythonTools } from '@shared/ipc/channels/python';

import { AnvilError, errorMessage } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { psQuote, shQuote } from '../../core/shell-quote';
import { toAbsolute } from '../../core/workspace/fs-guard';
import { discoverEnvs, envDirOf, findEnv, interpreterExists } from './envs';
import { activatedEnv, interpreter, setReplSupport } from './interpreter';
import { runRuffFormat } from './ruff-format';
import { cellCommand, CellStager, removeCellFiles, REPL_STARTUP, stagedCode } from './staged-cells';
import { LocalEnvWatcher } from './venv-watch';

const PickSchema = z.string().nullable();
const CACHE_MS = 60_000;

function exec(
	file: string,
	args: string[],
	env: NodeJS.ProcessEnv,
	timeout = 20_000,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		execFile(
			file,
			args,
			{ env, windowsHide: true, timeout, maxBuffer: 20 * 1024 * 1024 },
			// A spawn failure or timeout has no stderr; keep its message for diagnostics.
			(error, stdout, stderr) =>
				resolve({ ok: !error, stdout, stderr: stderr || (error?.message ?? '') }),
		);
	});
}

/** First non-empty line of a tool's stderr, for short error messages. */
function firstLine(text: string): string | null {
	return (
		text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.find((l) => l !== '') ?? null
	);
}

/** `pkg/sub/mod.py` → `pkg.sub.mod`, for `python -m`. */
export function moduleName(rel: string): string {
	return rel
		.replace(/\\/g, '/')
		.replace(/\.py$/, '')
		.replace(/\/__main__$/, '')
		.split('/')
		.join('.');
}

/**
 * `ruff format` over stdin. The file is named absolutely: ruff finds its settings by walking up
 * from --stdin-filename (nearest pyproject.toml / ruff.toml) and matches per-file settings against
 * that path. --force-exclude makes ruff honour `exclude` for a file it is handed directly (it
 * returns the text unchanged), as the VS Code extension does.
 */
export function ruffFormatArgs(absPath: string): string[] {
	return ['format', '--force-exclude', '--stdin-filename', absPath, '-'];
}

export const pythonFeature: MainFeature = {
	id: 'python',
	activate(ctx) {
		interpreter.configure(
			(root) => ctx.settings.get(`pick:${root.toLowerCase()}`, PickSchema, null),
			(root, path) => ctx.settings.set(`pick:${root.toLowerCase()}`, PickSchema, path),
		);
		let cache: { root: string | null; at: number; envs: PythonEnv[] } | null = null;
		const envs = async (refresh: boolean): Promise<PythonEnv[]> => {
			const root = ctx.workspace.root();
			if (!refresh && cache && cache.root === root && Date.now() - cache.at < CACHE_MS)
				return cache.envs;
			const found = await discoverEnvs(root);
			cache = { root, at: Date.now(), envs: found };
			// Lets resolve() fall back to a python.org / PATH install when there's no venv.
			interpreter.setSystem(
				root,
				found.filter((e) => e.kind === 'system').map((e) => e.path),
			);
			return found;
		};
		const current = (): string => {
			const python = interpreter.resolve(ctx.workspace.root());
			if (!python)
				throw new AnvilError(
					'PY_NONE',
					'No Python interpreter found. Install Python or create a venv (uv venv).',
				);
			return python;
		};
		const selectedFor = async (root: string | null): Promise<PythonEnv | null> => {
			const python = interpreter.resolve(root);
			if (!python) return null;
			const known = findEnv(await envs(false), python);
			return (
				known ?? {
					path: python,
					label: python,
					kind: 'system',
					version: null,
					local: false,
				}
			);
		};
		// `uv venv` in a terminal creates .venv behind Anvil's back; pick it up without a restart.
		const localEnvs = new LocalEnvWatcher({
			resolve: (root) => interpreter.resolve(root),
			onChange: () => {
				cache = null;
				interpreter.announce();
			},
			onError: (e) => ctx.log.warn('venv watch failed', { message: errorMessage(e) }),
		});
		localEnvs.start(ctx.workspace.root());
		ctx.onDispose(() => localEnvs.stop());
		const emitSelected = (): void => {
			localEnvs.sync();
			const root = ctx.workspace.root();
			void selectedFor(root)
				.then((env) => ctx.emit('python:changed', { root, env }))
				.catch((e: unknown) =>
					ctx.log.error('python:changed failed', { message: errorMessage(e) }),
				);
		};
		const off = interpreter.onChange(emitSelected);
		ctx.onDispose(off);
		// Discover once at startup so system Pythons are known before the first Run or REPL.
		void envs(false).catch((e: unknown) =>
			ctx.log.error('python discovery failed', { message: errorMessage(e) }),
		);
		ctx.workspace.onChange((root) => {
			cache = null;
			localEnvs.start(root);
			emitSelected();
		});

		ctx.ipc.handle('python:envs', ({ refresh }) => envs(refresh));
		ctx.ipc.handle('python:selected', () => selectedFor(ctx.workspace.root()));
		ctx.ipc.handle('python:select', async (path) => {
			const root = ctx.workspace.root();
			if (!root)
				throw new AnvilError('PY_NO_FOLDER', 'Open a folder to pick its interpreter');
			if (path !== null) {
				if (!interpreterExists(path))
					throw new AnvilError('PY_NOT_FOUND', `Interpreter not found: ${path}`);
				// Only a discovered interpreter: every REPL, Run and tool call spawns this path.
				// Rediscover once in case the env was created after the list was cached.
				if (!findEnv(await envs(false), path) && !findEnv(await envs(true), path))
					throw new AnvilError('PY_NOT_FOUND', `Not a known Python interpreter: ${path}`);
			}
			interpreter.pick(root, path);
		});

		ctx.ipc.handle('python:packages', async (): Promise<PythonPackage[]> => {
			const python = current();
			const env = activatedEnv(python);
			const pip = await exec(
				python,
				['-m', 'pip', 'list', '--format=json', '--disable-pip-version-check'],
				env,
			);
			// uv-created venvs have no pip; uv can list them instead.
			const out = pip.ok
				? pip
				: await exec('uv', ['pip', 'list', '--format', 'json', '--python', python], env);
			if (!out.ok) {
				ctx.log.warn('package listing failed', {
					python,
					pipStderr: pip.stderr.trim(),
					uvStderr: out.stderr.trim(),
				});
				const reason = firstLine(pip.stderr) ?? firstLine(out.stderr);
				throw new AnvilError(
					'PY_LIST_FAILED',
					`Could not list packages (pip and uv both failed)${reason ? `: ${reason}` : ''}`,
				);
			}
			try {
				const rows = JSON.parse(out.stdout) as Array<{ name: string; version: string }>;
				return rows.map((r) => ({ name: r.name, version: r.version }));
			} catch {
				throw new AnvilError('PY_LIST_FAILED', 'Unexpected package list output');
			}
		});

		ctx.ipc.handle('python:tools', async (): Promise<PythonTools> => {
			const python = current();
			const env = activatedEnv(python);
			const has = async (module: string): Promise<boolean> =>
				(await exec(python, ['-c', `import ${module}`], env, 10_000)).ok;
			const [ipython, pytest, ruff] = await Promise.all([
				has('IPython'),
				has('pytest'),
				exec('ruff', ['--version'], env, 5_000).then((r) => r.ok),
			]);
			return { ipython, pytest, ruff };
		});

		writeFileSync(join(ctx.dataDir, 'anvil_startup.py'), REPL_STARTUP, 'utf8');
		const cells = new CellStager(join(ctx.dataDir, 'cells'));
		for (const dir of [ctx.dataDir, cells.dir]) {
			try {
				removeCellFiles(dir);
			} catch (e) {
				// Leftovers only cost disk space; staging overwrites any number it reuses.
				ctx.log.warn('could not remove old staged cells', { message: errorMessage(e) });
			}
		}
		setReplSupport({ startup: join(ctx.dataDir, 'anvil_startup.py'), cells: cells.dir });
		ctx.ipc.handle('python:stageCell', ({ code, source }) => {
			const root = ctx.workspace.root();
			const file = source && root ? toAbsolute(root, source.path) : null;
			const text = file && source ? stagedCode(code, source.line) : code;
			return { command: cellCommand(cells.stage(text, file)) };
		});

		ctx.ipc.handle('python:runCommand', ({ path, module }) => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('PY_NO_FOLDER', 'Open a folder first');
			const python = current();
			const abs = toAbsolute(root, path);
			const rel = relative(root, abs).split(sep).join('/');
			const win = process.platform === 'win32';
			const quote = win ? psQuote : shQuote;
			const target = module ? `-m ${moduleName(rel)}` : quote(abs);
			return {
				command: win ? `& ${psQuote(python)} ${target}` : `${quote(python)} ${target}`,
			};
		});

		ctx.ipc.handle('python:format', async ({ path, content }) => {
			const root = ctx.workspace.root();
			const python = interpreter.resolve(root);
			const env = python ? activatedEnv(python) : process.env;
			const envRuff = python
				? join(
						envDirOf(python),
						process.platform === 'win32' ? 'Scripts\\ruff.exe' : 'bin/ruff',
					)
				: null;
			const ruff = envRuff && existsSync(envRuff) ? envRuff : 'ruff';
			// Run from the workspace root like VS Code's ruff does, so the fallback config and any
			// relative path ruff prints resolve against the project rather than a subfolder.
			const abs = root ? toAbsolute(root, path) : null;
			return runRuffFormat({
				ruff,
				args: ruffFormatArgs(abs ?? path),
				cwd: root ?? undefined,
				env,
				content,
				onStdinError: (message) => ctx.log.warn('ruff stdin', { message }),
			});
		});
	},
};
