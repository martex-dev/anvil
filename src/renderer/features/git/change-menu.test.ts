import { describe, expect, it, vi } from 'vitest';

import type { GitChange } from '@shared/ipc/channels/git';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));
const requestOpenFile = vi.fn();
vi.mock('../../stores/workbench-store', () => ({
	requestOpenFile: (...args: unknown[]) => requestOpenFile(...args) as unknown,
}));
vi.mock('../editor/tab-actions', () => ({ copyPath: vi.fn(), revealInExplorer: vi.fn() }));

const { changeMenuItems } = await import('./change-menu');

const change = (kind: GitChange['kind'], workspacePath: string | null = 'src/a.py'): GitChange => ({
	path: 'app/src/a.py',
	kind,
	workspacePath,
});
const labels = (items: ReturnType<typeof changeMenuItems>): string[] =>
	items.map((i) => (i === 'separator' ? '-' : `${i.label}${i.disabled ? ' (off)' : ''}`));

describe('changeMenuItems', () => {
	const handlers = { openDiff: vi.fn(), toggle: vi.fn() };

	it('offers file actions, stage and discard for an unstaged change', () => {
		const items = changeMenuItems(change('modified'), false, { ...handlers, discard: vi.fn() });
		expect(labels(items)).toEqual([
			'Open File',
			'Open Changes',
			'-',
			'Stage',
			'Discard Changes…',
			'-',
			'Copy Path',
			'Copy Relative Path',
			'Reveal in Explorer View',
			'Reveal in File Explorer',
		]);
		const open = items[0];
		if (open !== 'separator') open?.onSelect();
		expect(requestOpenFile).toHaveBeenCalledWith({ path: 'src/a.py' });
	});

	it('turns off what a deleted or outside-the-folder file cannot do', () => {
		expect(labels(changeMenuItems(change('deleted'), true, handlers))).toEqual([
			'Open File (off)',
			'Open Changes',
			'-',
			'Unstage',
			'-',
			'Copy Path',
			'Copy Relative Path',
			'Reveal in Explorer View (off)',
			'Reveal in File Explorer (off)',
		]);
		const outside = labels(changeMenuItems(change('untracked', null), false, handlers));
		expect(outside.filter((l) => l.endsWith('(off)'))).toHaveLength(5);
	});
});
