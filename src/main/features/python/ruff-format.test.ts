import { describe, expect, it, vi } from 'vitest';

import { runRuffFormat } from './ruff-format';

// Node stands in for ruff: each test runs a tiny script with the same stdin/stdout contract.
const fake = (script: string): { ruff: string; args: string[] } => ({
	ruff: process.execPath,
	args: ['-e', script],
});

describe('runRuffFormat', () => {
	it('resolves with the formatted stdout', async () => {
		const out = await runRuffFormat({
			...fake('process.stdin.pipe(process.stdout)'),
			cwd: undefined,
			env: process.env,
			content: 'x = 1\n',
		});
		expect(out).toEqual({ content: 'x = 1\n' });
	});

	it('rejects with stderr when ruff exits early, without an unhandled stdin error', async () => {
		const onStdinError = vi.fn();
		await expect(
			runRuffFormat({
				...fake("process.stderr.write('bad config'); process.exit(2)"),
				cwd: undefined,
				env: process.env,
				// Big enough that the pipe is still being written when the child exits.
				content: 'x'.repeat(8 * 1024 * 1024),
				onStdinError,
			}),
		).rejects.toMatchObject({ code: 'PY_FORMAT_FAILED', message: 'bad config' });
	});

	it('kills a hung ruff and rejects with a timeout', async () => {
		await expect(
			runRuffFormat({
				...fake('setTimeout(() => {}, 60_000)'),
				cwd: undefined,
				env: process.env,
				content: '',
				timeoutMs: 200,
			}),
		).rejects.toMatchObject({ code: 'PY_FORMAT_TIMEOUT' });
	});

	it('reports a missing executable as PY_NO_RUFF', async () => {
		await expect(
			runRuffFormat({
				ruff: 'anvil-definitely-not-ruff',
				args: [],
				cwd: undefined,
				env: process.env,
				content: '',
			}),
		).rejects.toMatchObject({ code: 'PY_NO_RUFF' });
	});
});
