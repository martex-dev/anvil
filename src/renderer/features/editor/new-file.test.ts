import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';
import { useWorkbenchStore } from '../../stores/workbench-store';

class FakeIpcError extends Error {
	constructor(
		readonly channel: string,
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}
type CreateInput = { parent: string; name: string; kind: 'file' | 'dir' };
const create = vi.fn((input: CreateInput) =>
	Promise.resolve({ path: input.parent ? `${input.parent}/${input.name}` : input.name }),
);
vi.mock('../../lib/ipc', () => ({
	call: (_channel: string, input: CreateInput) => create(input),
	IpcCallError: FakeIpcError,
}));
vi.mock('../../ui/QuickPick', () => ({ quickPick: vi.fn() }));

const { createFileAt, splitNewPath } = await import('./new-file');
const exists = (): FakeIpcError => new FakeIpcError('fs:create', 'FS_EXISTS', 'already exists');
const lastToast = () => useToastStore.getState().toasts.at(-1);

describe('new file', () => {
	const opened = vi.fn();
	beforeEach(() => {
		create.mockClear();
		opened.mockClear();
		useWorkbenchStore.getState().setOpenFileHandler((request) => opened(request.path));
	});

	it('splits Windows or POSIX paths and rejects missing names', () => {
		expect(splitNewPath('src\\strategy\\momentum.py')).toEqual({
			dirs: ['src', 'strategy'],
			name: 'momentum.py',
		});
		expect(splitNewPath('/a.py')).toEqual({ dirs: [], name: 'a.py' });
		expect(splitNewPath('src/')).toBeNull();
		expect(splitNewPath('src//a.py')).toBeNull();
		expect(splitNewPath('  ')).toBeNull();
	});

	it('creates missing folders, skips existing ones and opens the file', async () => {
		create.mockRejectedValueOnce(exists());
		await createFileAt('src/lib/a.py');
		expect(create.mock.calls.map(([c]) => c)).toEqual([
			{ parent: '', name: 'src', kind: 'dir' },
			{ parent: 'src', name: 'lib', kind: 'dir' },
			{ parent: 'src/lib', name: 'a.py', kind: 'file' },
		]);
		expect(opened).toHaveBeenCalledWith('src/lib/a.py');
	});

	it('opens a file that already exists instead of failing', async () => {
		create.mockResolvedValueOnce({ path: 'src' }).mockRejectedValueOnce(exists());
		await createFileAt('src/a.py');
		expect(opened).toHaveBeenCalledWith('src/a.py');
	});

	it('reports a folder that cannot be created instead of hiding it', async () => {
		create.mockRejectedValueOnce(new FakeIpcError('fs:create', 'FS_INVALID', 'Invalid name'));
		await createFileAt('bad:dir/a.py');
		expect(create).toHaveBeenCalledTimes(1);
		expect(opened).not.toHaveBeenCalled();
		expect(lastToast()).toMatchObject({ tone: 'error', description: 'Invalid name' });
	});

	it('asks for a file name when the path ends in a slash', async () => {
		await createFileAt('src/');
		expect(create).not.toHaveBeenCalled();
		expect(lastToast()?.title).toBe('Enter a file name');
	});
});
