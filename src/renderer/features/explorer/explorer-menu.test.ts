import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { selectedForCompare } from '../editor/compare';
import { explorerMenuItems } from './explorer-menu';
import type { MenuItem } from './ExplorerContextMenu';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));
vi.mock('../editor/compare', () => ({
	compareWithSelected: vi.fn(),
	selectedForCompare: vi.fn(() => null),
	selectForCompare: vi.fn(),
}));

const file: FsEntry = {
	name: 'a.py',
	path: 'src/a.py',
	kind: 'file',
	isLink: false,
	size: 1,
	mtimeMs: 1,
};

function item(target: FsEntry | null, label: string): MenuItem {
	const found = explorerMenuItems({
		target,
		startCreate: vi.fn(),
		rename: vi.fn(),
		remove: vi.fn(),
	}).find((i): i is MenuItem => i !== 'separator' && i.label === label);
	if (!found) throw new Error(`No menu item "${label}"`);
	return found;
}

/** Lets the async menu action settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
	vi.stubGlobal('navigator', { clipboard: { writeText } });
	writeText.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe('explorer menu: copy paths', () => {
	it('copies the absolute path and confirms it', async () => {
		vi.mocked(call).mockResolvedValue('C:\\work\\src\\a.py');
		const success = vi.spyOn(toast, 'success');
		item(file, 'Copy Path').onSelect();
		await flush();
		expect(call).toHaveBeenCalledWith('fs:copyPath', { path: 'src/a.py', absolute: true });
		expect(writeText).toHaveBeenCalledWith('C:\\work\\src\\a.py');
		expect(success).toHaveBeenCalledWith('Path copied', 'C:\\work\\src\\a.py');
	});

	it('copies the relative path through the main process', async () => {
		vi.mocked(call).mockResolvedValue('src\\a.py');
		item(file, 'Copy Relative Path').onSelect();
		await flush();
		expect(call).toHaveBeenCalledWith('fs:copyPath', { path: 'src/a.py', absolute: false });
		expect(writeText).toHaveBeenCalledWith('src\\a.py');
	});

	it('reports a clipboard failure instead of leaving it unhandled', async () => {
		vi.mocked(call).mockResolvedValue('src\\a.py');
		writeText.mockRejectedValue(new Error('Clipboard blocked'));
		const error = vi.spyOn(toast, 'error');
		item(file, 'Copy Relative Path').onSelect();
		await flush();
		expect(error).toHaveBeenCalledWith('Could not copy path', 'Clipboard blocked');
	});

	it('disables Copy Relative Path without a target', () => {
		expect(item(null, 'Copy Relative Path').disabled).toBe(true);
	});
});

describe('explorer menu: reveal', () => {
	it('reports a failed reveal', async () => {
		vi.mocked(call).mockRejectedValue(new Error('Explorer is not available'));
		const error = vi.spyOn(toast, 'error');
		item(file, 'Reveal in File Explorer').onSelect();
		await flush();
		expect(call).toHaveBeenCalledWith('fs:reveal', 'src/a.py');
		expect(error).toHaveBeenCalledWith(
			'Could not reveal in File Explorer',
			'Explorer is not available',
		);
	});
});

describe('explorer menu: entry actions', () => {
	const actions = {
		openToSide: vi.fn(),
		openInTerminal: vi.fn(),
		runPython: vi.fn(),
		cut: vi.fn(),
		copy: vi.fn(),
		paste: vi.fn(),
		canPaste: false,
		duplicate: vi.fn(),
	};
	const folder: FsEntry = { ...file, name: 'src', path: 'src', kind: 'dir' };
	const labels = (target: FsEntry | null, canPaste = false): string[] =>
		explorerMenuItems({
			target,
			startCreate: vi.fn(),
			rename: vi.fn(),
			remove: vi.fn(),
			actions: { ...actions, canPaste },
		}).flatMap((i) => (i === 'separator' ? [] : [i.label]));
	const pick = (target: FsEntry | null, label: string, canPaste = false): MenuItem => {
		const found = explorerMenuItems({
			target,
			startCreate: vi.fn(),
			rename: vi.fn(),
			remove: vi.fn(),
			actions: { ...actions, canPaste },
		}).find((i): i is MenuItem => i !== 'separator' && i.label === label);
		if (!found) throw new Error(`No menu item "${label}"`);
		return found;
	};

	it('offers Open to the Side and Run only where they apply', () => {
		expect(labels(file)).toEqual(
			expect.arrayContaining(['Open to the Side', 'Run Python File']),
		);
		expect(labels(folder)).not.toContain('Open to the Side');
		expect(labels({ ...file, name: 'a.csv', path: 'a.csv' })).not.toContain('Run Python File');
	});

	it('opens a terminal in the folder, or next to the file', () => {
		pick(folder, 'Open in Terminal').onSelect();
		pick(file, 'Open in Terminal').onSelect();
		pick(null, 'Open in Terminal').onSelect();
		expect(actions.openInTerminal.mock.calls).toEqual([['src'], ['src'], ['']]);
	});

	it('pastes into the folder under the pointer, only when something is held', () => {
		expect(pick(file, 'Paste').disabled).toBe(true);
		pick(file, 'Paste', true).onSelect();
		expect(actions.paste).toHaveBeenCalledWith('src');
		pick(file, 'Duplicate').onSelect();
		expect(actions.duplicate).toHaveBeenCalledWith('src/a.py');
		expect(pick(null, 'Cut').disabled).toBe(true);
	});
});

describe('explorer menu: compare', () => {
	it('enables Compare with Selected only for a different file', () => {
		const other: FsEntry = { ...file, name: 'b.py', path: 'src/b.py' };
		vi.mocked(selectedForCompare).mockReturnValue('src/a.py');
		expect(item(file, 'Compare with Selected').disabled).toBe(true);
		expect(item(other, 'Compare with Selected').disabled).toBe(false);
	});
});
