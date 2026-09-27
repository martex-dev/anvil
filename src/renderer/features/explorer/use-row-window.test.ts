import { describe, expect, it } from 'vitest';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { ROW_HEIGHT, rowWindow, WINDOW_FROM } from './use-row-window';
import { dropFolder } from './use-tree-dnd';

describe('rowWindow', () => {
	it('renders every row of a normal tree', () => {
		expect(rowWindow(200, 5000, 600)).toEqual({ start: 0, end: 200, before: 0, after: 0 });
	});

	it('renders only the rows around the viewport of a huge tree, with spacers', () => {
		const count = WINDOW_FROM * 4;
		const win = rowWindow(count, 1000 * ROW_HEIGHT, 600);
		expect(win.start).toBeLessThan(1000);
		expect(win.end).toBeGreaterThan(1000 + 600 / ROW_HEIGHT);
		expect(win.end - win.start).toBeLessThan(100);
		expect(win.before + (win.end - win.start) * ROW_HEIGHT + win.after).toBe(
			count * ROW_HEIGHT,
		);
	});

	it('clamps at both ends', () => {
		const count = WINDOW_FROM;
		expect(rowWindow(count, 0, 600).start).toBe(0);
		expect(rowWindow(count, count * ROW_HEIGHT, 600).end).toBe(count);
	});
});

describe('dropFolder', () => {
	const e = (path: string, kind: FsEntry['kind']): FsEntry => ({
		name: path,
		path,
		kind,
		isLink: false,
		size: 0,
		mtimeMs: 0,
	});
	const entries = new Map([
		['src', e('src', 'dir')],
		['src/a.py', e('src/a.py', 'file')],
	]);

	it('drops into a folder, next to a file, or into the root on empty space', () => {
		expect(dropFolder('src', entries)).toBe('src');
		expect(dropFolder('src/a.py', entries)).toBe('src');
		expect(dropFolder(null, entries)).toBe('');
	});
});
