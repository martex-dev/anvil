import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { changeFilter, DEFAULT_VIEW, useDataViewStore } from './data-view-store';

const view = (path: string) => useDataViewStore.getState().views[path] ?? DEFAULT_VIEW;
const update = useDataViewStore.getState().update;
const cell = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } };

beforeEach(() => {
	vi.useFakeTimers();
	useDataViewStore.setState({ views: {} });
});
afterEach(() => vi.useRealTimers());

describe('data view store', () => {
	it('keeps each file its own view', () => {
		update('a.csv', { sort: { column: 2, desc: true }, selection: cell });
		update('b.csv', { filter: 'eth' });
		expect(view('a.csv')).toMatchObject({ sort: { column: 2, desc: true }, selection: cell });
		expect(view('a.csv').filter).toBe('');
		expect(view('b.csv').sort).toBeNull();
	});

	it('forgets the least recently changed views past its limit', () => {
		for (let i = 0; i < 25; i++) update(`f${i}.csv`, { filter: String(i) });
		const paths = Object.keys(useDataViewStore.getState().views);
		expect(paths).toHaveLength(20);
		expect(paths).not.toContain('f0.csv');
		expect(paths).toContain('f24.csv');
	});
});

describe('changeFilter', () => {
	it('applies the filter once typing pauses and clears the selection', () => {
		update('a.csv', { selection: cell });
		changeFilter('a.csv', 'b');
		changeFilter('a.csv', 'bt');
		expect(view('a.csv')).toMatchObject({ filterInput: 'bt', filter: '', selection: cell });
		vi.advanceTimersByTime(250);
		expect(view('a.csv')).toMatchObject({ filter: 'bt', selection: null });
	});

	it('keeps the selection when the filter ends up unchanged', () => {
		update('a.csv', { selection: cell });
		changeFilter('a.csv', 'x');
		changeFilter('a.csv', '');
		vi.advanceTimersByTime(250);
		expect(view('a.csv').selection).toEqual(cell);
	});

	it('applies at once when asked', () => {
		update('a.csv', { filterInput: 'eth', filter: 'eth' });
		changeFilter('a.csv', '', true);
		expect(view('a.csv')).toMatchObject({ filterInput: '', filter: '' });
	});
});
