import type { ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { TestDiscovery, TestNode, TestRunEvent } from '@shared/ipc/channels/tests';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { killTree } from '../../core/process-utils';
import { shQuote } from '../../core/shell-quote';
import { interpreter } from '../python/interpreter';
import { PLUGIN_MODULE, PLUGIN_SOURCE } from './plugin-source';
import { ARGS_BUDGET, type PytestTarget, runPytest, spawnPytest } from './pytest-process';
import { readAll, type ReaderChunk, ReporterReader } from './reporter';
import { lastLine, pytestMissing, runError, RunTranslator } from './run-events';
import { buildTree, fileIdOf, indexTree, runArgs } from './tree';

const DISCOVER_TIMEOUT_MS = 120_000;
/** Output kept for Show Test Output; the tail matters most (failures and the summary). */
const OUTPUT_LIMIT = 2_000_000;

interface ActiveRun {
	id: number;
	child: ChildProcess;
	cancelled: boolean;
}

/** PowerShell also closes a single-quoted string at typographic quotes, so double those too. */
function psWord(s: string): string {
	return /^[\w:./\\-]+$/.test(s) ? s : `'${s.replace(/['‘’‚‛]/g, '$&$&')}'`;
}

/** Leaf test ids under the given nodes, for the "expected" set a run starts with. */
function leavesOf(nodes: readonly TestNode[]): string[] {
	const out: string[] = [];
	const walk = (list: readonly TestNode[]): void => {
		for (const node of list) {
			if (node.children.length === 0) {
				if (node.kind === 'function' || node.kind === 'case') out.push(node.id);
			} else walk(node.children);
		}
	};
	walk(nodes);
	return out;
}

/**
 * pytest Test Explorer backend (ADR-020): discovery and runs with the selected interpreter's
 * pytest, plus a tiny reporter plugin that streams one JSON line per test.
 */
export const testsFeature: MainFeature = {
	id: 'tests',
	activate(ctx) {
		writeFileSync(join(ctx.dataDir, `${PLUGIN_MODULE}.py`), PLUGIN_SOURCE, 'utf8');
		/** Last discovery, per folder: the only ids a run accepts. */
		let known: { root: string; index: Map<string, TestNode>; tree: TestNode[] } | null = null;
		let active: ActiveRun | null = null;
		let runCounter = 0;
		let lastOutput = '';

		const target = (): PytestTarget => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('TESTS_NO_FOLDER', 'Open a folder to run its tests');
			const python = interpreter.resolve(root);
			if (!python)
				throw new AnvilError(
					'TESTS_NO_PYTHON',
					'No Python interpreter found. Select one, or create a venv (uv venv).',
				);
			return { python, root, pluginDir: ctx.dataDir };
		};

		const cancel = async (): Promise<void> => {
			const run = active;
			if (!run) return;
			run.cancelled = true;
			if (run.child.pid !== undefined) await killTree(run.child.pid);
		};
		ctx.onDispose(cancel);
		ctx.workspace.onChange(() => {
			known = null;
			void cancel();
		});

		ctx.ipc.handle('tests:discover', async (): Promise<TestDiscovery> => {
			const root = ctx.workspace.root();
			if (!root) return { status: 'noFolder', python: null };
			const python = interpreter.resolve(root);
			if (!python) return { status: 'noPython', python: null };
			const out = await runPytest(
				{ python, root, pluginDir: ctx.dataDir },
				['--collect-only', '-p', 'no:cacheprovider'],
				DISCOVER_TIMEOUT_MS,
			);
			const text = `${out.stdout}\n${out.stderr}`;
			if (out.failure) throw new AnvilError('TESTS_DISCOVER_FAILED', out.failure);
			if (pytestMissing(text)) return { status: 'noPytest', python };
			const { records, output } = readAll(out.stdout);
			const items = records.filter((r) => r.t === 'item');
			const errors = records.flatMap((r) =>
				r.t === 'collecterror' ? [{ id: r.nodeid, message: r.message }] : [],
			);
			// 0 ok, 1 failures, 2 collection errors, 5 nothing found: all still a usable tree.
			const usable =
				records.some((r) => r.t === 'done') && out.exitCode !== 3 && out.exitCode !== 4;
			if (!usable) {
				ctx.log.warn('test discovery failed', {
					exitCode: out.exitCode,
					tail: lastLine(text),
				});
				return {
					status: 'failed',
					message:
						lastLine(`${output}\n${out.stderr}`) ??
						`pytest exited with ${out.exitCode}`,
					output: `${output}${out.stderr}`.slice(-OUTPUT_LIMIT),
				};
			}
			const tree = buildTree(items, root);
			known = { root, index: indexTree(tree), tree };
			return { status: 'ok', tree, errors, python };
		});

		/** Checks ids against the last discovery and turns them into pytest arguments. */
		const selection = (
			root: string,
			ids: readonly string[],
			files: readonly string[],
		): { args: string[]; expected: string[] } => {
			const index = known?.root === root ? known.index : new Map<string, TestNode>();
			const { args, unknown } = runArgs(ids, files, index, root);
			if (unknown.length > 0)
				throw new AnvilError(
					'TESTS_UNKNOWN',
					`Not a discovered test: ${unknown[0] ?? ''}. Refresh the test list and try again.`,
				);
			const nodes = ids.flatMap((id) => {
				const node = index.get(id);
				return node ? [node] : [];
			});
			const expected =
				ids.length === 0 && files.length === 0
					? leavesOf(known?.tree ?? [])
					: leavesOf(nodes);
			// Too long for Windows: run the files that hold the selection instead.
			if (args.join(' ').length > ARGS_BUDGET) {
				const whole = [...new Set(args.map((a) => fileIdOf(a)))];
				return { args: whole, expected };
			}
			return { args, expected };
		};

		ctx.ipc.handle('tests:run', async ({ ids, files }) => {
			const where = target();
			const { args, expected } = selection(where.root, ids, files);
			await cancel();
			const runId = ++runCounter;
			const emit = (event: TestRunEvent): void => ctx.emit('tests:event', event);
			const translator = new RunTranslator(runId);
			const reader = new ReporterReader();
			lastOutput = '';
			// A module that fails to import must not stop every other file's tests from running.
			const child = spawnPytest(where, ['--continue-on-collection-errors', ...args]);
			const run: ActiveRun = { id: runId, child, cancelled: false };
			active = run;
			emit({ type: 'started', runId, ids: expected });

			const output = (text: string): void => {
				if (!text) return;
				lastOutput = (lastOutput + text).slice(-OUTPUT_LIMIT);
				emit({ type: 'output', runId, text });
			};
			const take = (chunk: ReaderChunk): void => {
				output(chunk.output);
				for (const record of chunk.records)
					for (const event of translator.translate(record)) emit(event);
			};
			let spawnError: string | null = null;
			child.stdout?.on('data', (data: string) => take(reader.push(data)));
			child.stderr?.on('data', (data: string) => output(data));
			child.on('error', (error) => {
				spawnError = `Could not start ${where.python}: ${error.message}`;
				ctx.log.error('pytest failed to start', {
					python: where.python,
					message: error.message,
				});
			});
			child.on('close', (code) => {
				take(reader.flush());
				if (active === run) active = null;
				const error =
					spawnError ??
					runError({
						exitCode: code,
						cancelled: run.cancelled,
						sawRecord: translator.sawRecord,
						output: lastOutput,
						python: where.python,
					});
				if (error) ctx.log.warn('test run failed', { exitCode: code, error });
				emit({
					type: 'finished',
					runId,
					exitCode: run.cancelled ? null : code,
					cancelled: run.cancelled,
					error,
				});
			});
			return { runId };
		});

		ctx.ipc.handle('tests:cancel', cancel);
		ctx.ipc.handle('tests:output', () => ({ text: lastOutput }));

		ctx.ipc.handle('tests:debugCommand', ({ ids }) => {
			const where = target();
			const { args } = selection(where.root, ids, []);
			// No reporter here: the terminal is for reading and typing into pdb.
			const words = ['-m', 'pytest', '--pdb', ...args];
			const win = process.platform === 'win32';
			const quote = win
				? psWord
				: (s: string): string => (/^[\w:./-]+$/.test(s) ? s : shQuote(s));
			const command = [quote(where.python), ...words.map(quote)].join(' ');
			return { command: win ? `& ${command}` : command };
		});
	},
};
