import { create } from 'zustand';

import type { SortState } from './data-format';
import type { GridSelection } from './grid-selection';

/**
 * How a table is being looked at. Kept outside the viewer because a group only mounts its
 * active tab: switching between two data tabs would otherwise throw all of this away.
 */
export interface DataView {
	/** What is typed in the filter box. */
	filterInput: string;
	/** The filter the table is queried with (filterInput once typing pauses). */
	filter: string;
	sort: SortState | null;
	selection: GridSelection | null;
	profileColumn: number | null;
	profileOpen: boolean;
	/** Column widths, valid only for the column set (`key`) they were set on. */
	widths: { key: string; values: number[] } | null;
}

export const DEFAULT_VIEW: DataView = {
	filterInput: '',
	filter: '',
	sort: null,
	selection: null,
	profileColumn: null,
	profileOpen: true,
	widths: null,
};

export type DataViewPatch = Partial<DataView> | ((view: DataView) => Partial<DataView>);

/** Views remembered, most recently changed last; old files' views are dropped past this. */
const MAX_VIEWS = 20;
const FILTER_DEBOUNCE_MS = 250;

interface DataViewState {
	/** Keyed by workspace-relative path, like data tabs themselves. */
	views: Record<string, DataView>;
	update: (path: string, patch: DataViewPatch) => void;
}

export const useDataViewStore = create<DataViewState>((set) => ({
	views: {},
	update: (path, patch) =>
		set((s) => {
			const current = s.views[path] ?? DEFAULT_VIEW;
			const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
			const others = Object.entries(s.views)
				.filter(([p]) => p !== path)
				.slice(-(MAX_VIEWS - 1));
			return { views: Object.fromEntries([...others, [path, next]]) };
		}),
}));

const filterTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Typing updates the box at once; the filter itself (a query over every row) applies once
 * typing pauses, or at once with `immediate`. Only a real change clears the selection.
 */
export function changeFilter(path: string, value: string, immediate = false): void {
	const { update } = useDataViewStore.getState();
	update(path, { filterInput: value });
	clearTimeout(filterTimers.get(path));
	const commit = (): void => {
		filterTimers.delete(path);
		update(path, (view) => (view.filter === value ? {} : { filter: value, selection: null }));
	};
	if (immediate) commit();
	else filterTimers.set(path, setTimeout(commit, FILTER_DEBOUNCE_MS));
}
