import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FsEntry } from '@shared/ipc/channels/fs';

const call = vi.fn();
const quickPick = vi.fn();
const renameOpenPath = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

class IpcCallError extends Error {
	constructor(
		readonly channel: string,
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}

vi.mock('../../lib/ipc', () => ({ call: (...a: unknown[]) => call(...a), IpcCallError }));
vi.mock('../../ui/QuickPick', () => ({ quickPick: (...a: unknown[]) => quickPick(...a) }));
vi.mock('../editor/rename', () => ({ renameOpenPath: (...a: unknown[]) => renameOpenPath(...a) }));
vi.mock('../../stores/toast-store', () => ({
	toast: { error: toastError, info: toastInfo, success: vi.fn(), warn: vi.fn() },
}));

const { createPath, nameParts, transferPaths, transferProblem } = await import('./explorer-ops');

const entry = (path: string, kind: FsEntry['kind'] = 'file'): FsEntry => ({
	name: path.split('/').at(-1) ?? path,
	path,
	kind,
	isLink: false,
	size: 0,
	mtimeMs: 0,
});
const exists = (): IpcCallError => new IpcCallError('fs:x', 'FS_EXISTS', 'already exists');

beforeEach(() => {
	call.mockReset();
	quickPick.mockReset();
	renameOpenPath.mockReset();
	toastError.mockReset();
	toastInfo.mockReset();
});

describe('createPath', () => {
	it('creates the folders a nested name passes through, reusing existing ones', async () => {
		call.mockImplementation((_channel: string, v: { parent: string; name: string }) =>
			v.name === 'models'
				? Promise.reject(exists())
				: Promise.resolve(entry(v.parent ? `${v.parent}/${v.name}` : v.name)),
		);
		const created = await createPath('src', 'models/lstm/net.py', 'file');
		expect(created.path).toBe('src/models/lstm/net.py');
		expect(call.mock.calls.map((c) => c[1])).toEqual([
			{ parent: 'src', name: 'models', kind: 'dir' },
			{ parent: 'src/models', name: 'lstm', kind: 'dir' },
			{ parent: 'src/models/lstm', name: 'net.py', kind: 'file' },
		]);
	});

	it('reports a clash on the item itself and other failures on the way', async () => {
		call.mockRejectedValue(exists());
		await expect(createPath('', 'a.py', 'file')).rejects.toThrow('already exists');
		call.mockRejectedValueOnce(new IpcCallError('fs:create', 'FS_PERMISSION', 'denied'));
		await expect(createPath('', 'a/b.py', 'file')).rejects.toThrow('denied');
	});

	it('splits on either slash', () => {
		expect(nameParts('a\\b/c.py')).toEqual(['a', 'b', 'c.py']);
	});
});

describe('transferProblem', () => {
	it('refuses a folder into itself and a move to where it already is', () => {
		expect(transferProblem('move', ['src'], 'src/lib')).toMatch(/inside itself/);
		expect(transferProblem('copy', ['src'], 'src')).toMatch(/inside itself/);
		expect(transferProblem('move', ['src/a.py'], 'src')).toMatch(/Already/);
		expect(transferProblem('copy', ['src/a.py'], 'src')).toBeNull();
		expect(transferProblem('move', ['src/a.py'], '')).toBeNull();
		expect(transferProblem('move', [], '')).toMatch(/Nothing/);
	});
});

describe('transferPaths', () => {
	it('moves, and open tabs follow the file', async () => {
		call.mockResolvedValue(entry('out/a.py'));
		const done = await transferPaths('C:\\p', 'move', ['src/a.py'], 'out');
		expect(call).toHaveBeenCalledWith('fs:move', { path: 'src/a.py', targetDir: 'out' });
		expect(renameOpenPath).toHaveBeenCalledWith('C:\\p', 'src/a.py', 'out/a.py');
		expect(done.map((e) => e.path)).toEqual(['out/a.py']);
	});

	it('asks before replacing, and skipping leaves both files alone', async () => {
		call.mockRejectedValueOnce(exists()).mockResolvedValueOnce(entry('out/a.py'));
		quickPick.mockResolvedValueOnce('replace');
		await transferPaths('C:\\p', 'move', ['src/a.py'], 'out');
		expect(call).toHaveBeenLastCalledWith('fs:move', {
			path: 'src/a.py',
			targetDir: 'out',
			overwrite: true,
		});

		call.mockReset().mockRejectedValueOnce(exists());
		quickPick.mockResolvedValueOnce('skip');
		const done = await transferPaths('C:\\p', 'move', ['src/b.py'], 'out');
		expect(done).toEqual([]);
		expect(call).toHaveBeenCalledTimes(1);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('copies without asking and reports failures per item', async () => {
		call.mockResolvedValueOnce(entry('src/a copy.py')).mockRejectedValueOnce(
			new Error('locked'),
		);
		const done = await transferPaths('C:\\p', 'copy', ['src/a.py', 'src/b.py'], 'src');
		expect(done.map((e) => e.path)).toEqual(['src/a copy.py']);
		expect(toastError).toHaveBeenCalledWith('Could not copy src/b.py', 'locked');
		expect(renameOpenPath).not.toHaveBeenCalled();
	});

	it('says why nothing happened for an impossible drop', async () => {
		expect(await transferPaths('C:\\p', 'move', ['src'], 'src/lib')).toEqual([]);
		expect(call).not.toHaveBeenCalled();
		expect(toastInfo).toHaveBeenCalledWith('Not moved', expect.stringMatching(/itself/));
	});
});
