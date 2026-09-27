import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FsEntry } from '@shared/ipc/channels/fs';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) }));
vi.mock('../../stores/workbench-store', () => ({ requestOpenFile: vi.fn() }));

const { queryClient } = await import('../../lib/query-client');
const { existingFile, keepExisting } = await import('./terminal-links');
const { findFileLinks } = await import('./file-links');

const ROOT = 'C:\\lab';
const entry = (path: string, kind: FsEntry['kind'] = 'file'): FsEntry => ({
	name: path.split('/').at(-1) ?? path,
	path,
	kind,
	isLink: false,
	size: 1,
	mtimeMs: 1,
});

beforeEach(() => {
	queryClient.clear();
	call.mockReset().mockImplementation((channel: string, dir: string) => {
		if (channel !== 'fs:list') throw new Error(`unexpected ${channel}`);
		if (dir === '') return Promise.resolve([entry('src', 'dir'), entry('Bt.py')]);
		if (dir === 'src') return Promise.resolve([entry('src/risk.py')]);
		return Promise.reject(new Error(`Cannot list "${dir}"`));
	});
});

describe('existingFile', () => {
	it('finds files case-insensitively and returns their spelling on disk', async () => {
		expect(await existingFile(ROOT, 'bt.py')).toBe('Bt.py');
		expect(await existingFile(ROOT, 'src/risk.py')).toBe('src/risk.py');
	});

	it('is null for folders, missing files and folders that do not exist', async () => {
		expect(await existingFile(ROOT, 'src')).toBeNull();
		expect(await existingFile(ROOT, 'np.mean')).toBeNull();
		expect(await existingFile(ROOT, 'pandas/frame.py')).toBeNull();
	});

	it('lists each folder once while it is fresh', async () => {
		await existingFile(ROOT, 'bt.py');
		await existingFile(ROOT, 'other.py');
		expect(call).toHaveBeenCalledTimes(1);
	});
});

describe('keepExisting', () => {
	it('drops links to files that do not exist', async () => {
		const line = 'np.mean:3 then src/risk.py:12:5 and example.com:443';
		const kept = await keepExisting(findFileLinks(line, ROOT), (p) => existingFile(ROOT, p));
		expect(kept.map((l) => [l.path, l.line, l.column])).toEqual([['src/risk.py', 12, 5]]);
	});
});
