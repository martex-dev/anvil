import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { z } from 'zod';

import type { PythonEnv, PythonPackage, PythonTools } from '@shared/ipc/channels/python';

import { AnvilError, errorMessage } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { toAbsolute } from '../../core/workspace/fs-guard';
import { discoverEnvs, envDirOf, findEnv } from './envs';
import { activatedEnv, interpreter, setReplSupport } from './interpreter';
import { runRuffFormat } from './ruff-format';

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

/** PowerShell single-quoted literal: only ' needs escaping (as ''). */
export const psQuote = (s: string): string => `'${s.replace(/'/g, "''")}'`;

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
 * Loaded into every Anvil REPL through PYTHONSTARTUP (plain python and IPython both honour it).
 * `_cell(n)` runs staged cell n in the REPL's own namespace, so the prompt echoes a short call
 * instead of a long exec() line. Not `%run -i`: on Windows IPython keeps the quotes of a quoted
 * path, and userData paths often contain spaces. `cell_n.src` names the file the cell came
 * from; compiling under that name makes tracebacks (and terminal links) point at the source.
 */
export const REPL_STARTUP = [
	'# Anvil REPL helpers. _cell(n) runs a staged "# %%" cell in this namespace.',
	'def _cell(n):',
	'\timport os as _os',
	"\t_d = _os.environ['ANVIL_CELLS']",
	"\t_p = _os.path.join(_d, 'cell_%d.py' % n)",
	"\twith open(_p, encoding='utf-8') as _f:",
	'\t\t_code = _f.read()',
	'\ttry:',
	"\t\twith open(_os.path.join(_d, 'cell_%d.src' % n), encoding='utf-8') as _f:",
	'\t\t\t_p = _f.read().strip() or _p',
	'\texcept OSError:',
	'\t\tpass',
	"\texec(compile(_code, _p, 'exec'), globals())",
	'',
].join('\n');

/** Staged cell text: blank lines in front so traceback line numbers match the source file. */
export function stagedCode(code: string, line: number): string {
	return '\n'.repeat(Math.max(0, line - 1)) + code;
}

export function cellCommand(n: number): string {
	return `_cell(${n})`;
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
		const selected = async (): Promise<PythonEnv | null> => {
			const python = interpreter.resolve(ctx.workspace.root());
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
		const emitSelected = (): void =>
			void selected()
				.then((env) => ctx.emit('python:changed', env))
				.catch((e: unknown) =>
					ctx.log.error('python:changed failed', { message: errorMessage(e) }),
				);
		const off = interpreter.onChange(emitSelected);
		ctx.onDispose(off);
		ctx.workspace.onChange(() => {
			cache = null;
			emitSelected();
		});

		ctx.ipc.handle('python:envs', ({ refresh }) => envs(refresh));
		ctx.ipc.handle('python:selected', selected);
		ctx.ipc.handle('python:select', async (path) => {
			const root = ctx.workspace.root();
			if (!root)
				throw new AnvilError('PY_NO_FOLDER', 'Open a folder to pick its interpreter');
			if (path !== null) {
				if (!existsSync(path))
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
		setReplSupport({ startup: join(ctx.dataDir, 'anvil_startup.py'), cells: ctx.dataDir });
		let cellCounter = 0;
		ctx.ipc.handle('python:stageCell', ({ code, source }) => {
			// Rotate a few files so a cell still running is never overwritten by the next one.
			const n = cellCounter++ % 8;
			const root = ctx.workspace.root();
			const file = source && root ? toAbsolute(root, source.path) : null;
			const text = file && source ? stagedCode(code, source.line) : code;
			writeFileSync(join(ctx.dataDir, `cell_${n}.py`), text, 'utf8');
			// Always rewritten, so a rotated slot never keeps the previous cell's file name.
			writeFileSync(join(ctx.dataDir, `cell_${n}.src`), file ?? '', 'utf8');
			return { command: cellCommand(n) };
		});

		ctx.ipc.handle('python:runCommand', ({ path, module }) => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('PY_NO_FOLDER', 'Open a folder first');
			const python = current();
			const abs = toAbsolute(root, path);
			const rel = relative(root, abs).split(sep).join('/');
			const target = module ? `-m ${moduleName(rel)}` : psQuote(abs);
			return {
				command:
					process.platform === 'win32'
						? `& ${psQuote(python)} ${target}`
						: `'${python}' ${module ? `-m ${moduleName(rel)}` : `'${abs}'`}`,
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
			// Run from the file's folder so ruff finds the project's pyproject/ruff.toml.
			const cwd = root ? dirname(toAbsolute(root, path)) : undefined;
			return runRuffFormat({
				ruff,
				args: ['format', '--stdin-filename', path, '-'],
				cwd,
				env,
				content,
				onStdinError: (message) => ctx.log.warn('ruff stdin', { message }),
			});
		});
	},
};
