import { type ChildProcess, spawn } from 'node:child_process';
import { delimiter } from 'node:path';

import { killTree } from '../../core/process-utils';
import { activatedEnv } from '../python/interpreter';
import { PLUGIN_MODULE } from './plugin-source';

export interface PytestTarget {
	python: string;
	/** Working directory: the open folder. */
	root: string;
	/** Folder holding the reporter plugin. */
	pluginDir: string;
}

/**
 * Windows caps a command line at 32 767 characters. Past this budget a run falls back to whole
 * files (which runs a few extra tests) instead of failing to start.
 */
export const ARGS_BUDGET = 24_000;

/** pytest's own arguments plus the reporter; the caller's selection goes last. */
export function pytestArgs(extra: readonly string[]): string[] {
	// No colours: the output is shown as plain text. -q keeps it short (dots + summary).
	return ['-m', 'pytest', '-p', PLUGIN_MODULE, '--color=no', '-q', ...extra];
}

/**
 * The selected interpreter's environment (as if activated) with the plugin folder on
 * PYTHONPATH, unbuffered UTF-8 output so results stream and non-ASCII names survive.
 */
export function pytestEnv(python: string, pluginDir: string): NodeJS.ProcessEnv {
	const env = activatedEnv(python);
	const key = Object.keys(env).find((k) => k.toUpperCase() === 'PYTHONPATH') ?? 'PYTHONPATH';
	env[key] = env[key] ? `${pluginDir}${delimiter}${env[key]}` : pluginDir;
	env['PYTHONUNBUFFERED'] = '1';
	env['PYTHONIOENCODING'] = 'utf-8';
	return env;
}

/** Starts pytest without a shell: arguments are never parsed by cmd or PowerShell. */
export function spawnPytest(target: PytestTarget, extra: readonly string[]): ChildProcess {
	const child = spawn(target.python, pytestArgs(extra), {
		cwd: target.root,
		env: pytestEnv(target.python, target.pluginDir),
		windowsHide: true,
		// Its own process group on POSIX, so cancelling also stops what the tests spawned.
		detached: process.platform !== 'win32',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	child.stdout?.setEncoding('utf8');
	child.stderr?.setEncoding('utf8');
	return child;
}

export interface PytestOutput {
	exitCode: number | null;
	stdout: string;
	stderr: string;
	/** Set when the interpreter couldn't be started at all, or the timeout hit. */
	failure: string | null;
}

/** Runs pytest to completion (discovery), killing it after `timeoutMs`. */
export function runPytest(
	target: PytestTarget,
	extra: readonly string[],
	timeoutMs: number,
): Promise<PytestOutput> {
	return new Promise((resolve) => {
		const child = spawnPytest(target, extra);
		let stdout = '';
		let stderr = '';
		let failure: string | null = null;
		const timer = setTimeout(() => {
			failure = `pytest did not finish within ${Math.round(timeoutMs / 1000)} s`;
			if (child.pid !== undefined) void killTree(child.pid);
		}, timeoutMs);
		child.stdout?.on('data', (chunk: string) => (stdout += chunk));
		child.stderr?.on('data', (chunk: string) => (stderr += chunk));
		child.on('error', (error) => {
			failure = `Could not start ${target.python}: ${error.message}`;
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			resolve({ exitCode: code, stdout, stderr, failure });
		});
	});
}
