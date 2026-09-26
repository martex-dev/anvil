import { execFile } from 'node:child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { which } from './presets';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

type Callback = (error: Error | null, stdout: string) => void;
const execFileMock = vi.mocked(execFile) as unknown as ReturnType<
	typeof vi.fn<(file: string, args: string[], opts: unknown, cb: Callback) => void>
>;

/** Makes the next where.exe / which lookup find `path` (or nothing, for null). */
function nextLookup(path: string | null): void {
	execFileMock.mockImplementationOnce((_file, _args, _opts, cb) =>
		path ? cb(null, `${path}\n`) : cb(new Error('not found'), ''),
	);
}

beforeEach(() => execFileMock.mockReset());

describe('which', () => {
	it('does not cache a miss, so a freshly installed CLI is found on the next check', async () => {
		nextLookup(null);
		expect(await which('anvil-test-cli-a')).toBeNull();
		nextLookup('/usr/local/bin/anvil-test-cli-a');
		expect(await which('anvil-test-cli-a')).toBe('/usr/local/bin/anvil-test-cli-a');
		expect(execFileMock).toHaveBeenCalledTimes(2);
	});

	it('caches a hit briefly', async () => {
		nextLookup('/usr/bin/anvil-test-cli-b');
		expect(await which('anvil-test-cli-b')).toBe('/usr/bin/anvil-test-cli-b');
		expect(await which('anvil-test-cli-b')).toBe('/usr/bin/anvil-test-cli-b');
		expect(execFileMock).toHaveBeenCalledTimes(1);
	});
});
