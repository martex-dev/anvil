import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Tab, useTabsStore } from '../../stores/tabs-store';

vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { dropIndex, dropSide, dropTab } = await import('./tab-drop');

const tab = (id: string): Tab => ({ id, kind: 'code', path: `${id}.py`, title: `${id}.py` });
const order = (group = 0): string[] =>
	useTabsStore.getState().groups.find((g) => g.id === group)?.tabIds ?? [];
const drag = (id: string, group = 0): string => JSON.stringify({ id, group });

describe('tab drag and drop', () => {
	beforeEach(() => {
		useTabsStore.getState().reset();
		for (const id of ['a', 'b', 'c', 'd']) useTabsStore.getState().open(tab(id));
	});

	it('picks the side from the half of the tab under the pointer', () => {
		expect(dropSide(10, { left: 0, width: 100 })).toBe('before');
		expect(dropSide(60, { left: 0, width: 100 })).toBe('after');
	});

	it('lands on the side the indicator shows, dragging either way', () => {
		expect(dropIndex(0, 2, 'before')).toBe(1);
		expect(dropIndex(0, 2, 'after')).toBe(2);
		expect(dropIndex(3, 1, 'before')).toBe(1);
		expect(dropIndex(3, 1, 'after')).toBe(2);
	});

	it('moves a tab right, before or after the target', () => {
		dropTab(drag('a'), 0, 'c', 'before');
		expect(order()).toEqual(['b', 'a', 'c', 'd']);
		dropTab(drag('a'), 0, 'c', 'after');
		expect(order()).toEqual(['b', 'c', 'a', 'd']);
	});

	it('moves a tab left, before or after the target', () => {
		dropTab(drag('d'), 0, 'b', 'before');
		expect(order()).toEqual(['a', 'd', 'b', 'c']);
		dropTab(drag('c'), 0, 'a', 'after');
		expect(order()).toEqual(['a', 'c', 'd', 'b']);
	});

	it('inserts a tab from the other group next to the target', () => {
		useTabsStore.getState().split('d');
		useTabsStore.getState().open(tab('e'), { group: 1 });
		dropTab(drag('e', 1), 0, 'b', 'before');
		expect(order()).toEqual(['a', 'e', 'b', 'c', 'd']);
		expect(order(1)).not.toContain('e');
	});

	it('ignores a malformed payload', () => {
		dropTab('not json', 0, 'b', 'before');
		expect(order()).toEqual(['a', 'b', 'c', 'd']);
	});
});
