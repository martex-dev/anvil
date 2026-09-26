import { spawn } from 'node:child_process';

import { AnvilError, errorMessage } from '../../core/errors';

export const RUFF_FORMAT_TIMEOUT_MS = 20_000;

export interface RuffFormatOptions {
	/** `ruff` on PATH or the env's own ruff executable. */
	ruff: string;
	args: string[];
	cwd: string | undefined;
	env: NodeJS.ProcessEnv;
	content: string;
	timeoutMs?: number;
	/** Called when writing stdin fails (ruff exited early); the close/timeout still settles. */
	onStdinError?: (message: string) => void;
}

/**
 * Pipes `content` through `ruff format -` and resolves with the formatted text. A ruff that
 * exits before reading stdin (EPIPE) must not become an unhandled 'error' in main, and a hung
 * ruff is killed after `timeoutMs` so Format never stays pending forever.
 */
export function runRuffFormat(options: RuffFormatOptions): Promise<{ content: string }> {
	const { ruff, args, cwd, env, content, onStdinError } = options;
	const timeoutMs = options.timeoutMs ?? RUFF_FORMAT_TIMEOUT_MS;
	return new Promise((resolve, reject) => {
		let settled = false;
		const settle = (fn: () => void): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			fn();
		};
		const child = spawn(ruff, args, { cwd, env, windowsHide: true });
		const timer = setTimeout(() => {
			child.kill();
			settle(() => reject(new AnvilError('PY_FORMAT_TIMEOUT', 'ruff format timed out')));
		}, timeoutMs);
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (b: Buffer) => (stdout += b.toString('utf8')));
		child.stderr.on('data', (b: Buffer) => (stderr += b.toString('utf8')));
		child.stdin.on('error', (e) => onStdinError?.(errorMessage(e)));
		child.on('error', (e) =>
			settle(() =>
				reject(
					new AnvilError(
						'PY_NO_RUFF',
						'ruff is not installed. Add it with `uv add --dev ruff` or `pip install ruff`.',
						e,
					),
				),
			),
		);
		child.on('close', (code) =>
			settle(() => {
				if (code === 0) resolve({ content: stdout });
				else
					reject(
						new AnvilError(
							'PY_FORMAT_FAILED',
							stderr.trim().split(/\r?\n/).slice(0, 3).join(' ') || 'ruff failed',
						),
					);
			}),
		);
		child.stdin.end(content);
	});
}
