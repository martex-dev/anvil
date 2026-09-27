import { describe, expect, it } from 'vitest';

import { cancelPythonReads, runReader } from './python-reader';

// Node stands in for Python: the process contract (stdout, exit code) is what matters.
const node = (script: string): Promise<string> =>
	runReader(process.execPath, ['-e', script], process.env);

describe('runReader', () => {
	it('resolves with stdout', async () => {
		await expect(node("process.stdout.write('{}')")).resolves.toBe('{}');
	});

	it('stops a running read on cancel (folder switch, quit) and says so', async () => {
		const started = Date.now();
		const read = node('setTimeout(() => {}, 60_000)');
		cancelPythonReads();
		await expect(read).rejects.toMatchObject({ code: 'DATA_CANCELLED' });
		expect(Date.now() - started).toBeLessThan(10_000);
		// Reads started afterwards are unaffected.
		await expect(node("process.stdout.write('ok')")).resolves.toBe('ok');
	});
});
