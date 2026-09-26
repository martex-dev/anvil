import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import type { SearchQuery, SearchResult } from '@shared/ipc/channels/search';

import { call, IpcCallError } from '../../lib/ipc';
import { useLayoutStore } from '../../stores/layout-store';

/** Search box state; kept outside the view so it survives switching side views. */
export const useSearchParams = create<{
	params: Record<string, unknown>;
	setParams: (patch: Record<string, unknown>) => void;
}>((set) => ({
	params: {},
	setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
}));

/**
 * Bumped by the "Search in Files" command so the panel focuses its input even if already open.
 * `query` is set when the request also replaces the search text (searchInFiles), else null.
 */
export const useSearchFocus = create<{
	tick: number;
	query: string | null;
	focus: (query?: string) => void;
}>((set) => ({
	tick: 0,
	query: null,
	focus: (query) => set((s) => ({ tick: s.tick + 1, query: query ?? null })),
}));

/**
 * Opens the Search view with `query` as a literal search (e.g. a clicked Markdown #tag). The panel
 * adopts the new query even when it is already open, because the focus tick changes.
 */
export function searchInFiles(query: string): void {
	useSearchParams.getState().setParams({ query, regex: false });
	useLayoutStore.getState().showView('search');
	useSearchFocus.getState().focus(query);
}

export function useFileSearch(
	root: string | null,
	query: SearchQuery,
): { result: SearchResult | undefined; isFetching: boolean; error: Error | null } {
	const q = useQuery({
		queryKey: ['search', root, query],
		queryFn: () => call('search:run', query),
		enabled: root !== null && query.query.trim().length > 0,
		// Keep showing the last results while the next query runs (no flicker while typing).
		placeholderData: keepPreviousData,
		staleTime: 5_000,
		retry: false,
	});
	// A search replaced by a newer keystroke isn't an error worth showing.
	const cancelled = q.error instanceof IpcCallError && q.error.code === 'SEARCH_CANCELLED';
	return { result: q.data, isFetching: q.isFetching, error: cancelled ? null : q.error };
}
