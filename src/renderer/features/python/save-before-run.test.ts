import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenFile } from '../editor/editor-store';

const saveFile = vi.fn<(path: string) => Promise<boolean>>();
vi.mock('../editor/file-ops', () => ({
	saveFile: (path: string) => saveFile(path),
	isScratch: (path: string) => path === '__scratch__',
}));
vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));

const { useEditorStore } = await import('../editor/editor-store');
const { saveDirtyFiles } = await import('./save-before-run');

function file(path: string, dirty: boolean): OpenFile {
	return { path, name: path, state: 'ready', dirty, mtimeMs: 0, changedOnDisk: false };
}

beforeEach(() => {
	saveFile.mockReset();
	useEditorStore.setState({
		files: [
			file('a.py', true),
			file('b.py', false),
			file('__scratch__', true),
			file('c.py', true),
		],
	});
});

describe('saveDirtyFiles', () => {
	it('saves only dirty, real files', async () => {
		saveFile.mockResolvedValue(true);
		expect(await saveDirtyFiles()).toBe(true);
		expect(saveFile.mock.calls.map((c) => c[0])).toEqual(['a.py', 'c.py']);
	});

	it('reports a failed save but still tries the others', async () => {
		saveFile.mockImplementation((p) => Promise.resolve(p !== 'a.py'));
		expect(await saveDirtyFiles()).toBe(false);
		expect(saveFile).toHaveBeenCalledWith('c.py');
	});
});
