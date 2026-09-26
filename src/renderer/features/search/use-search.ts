import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import type { SearchQuery, SearchResult } from '@shared/ipc/channels/search';

import { call, IpcCallError } from '../../lib/ipc';
import { useFsRefresh } from '../../lib/use-fs-refresh';
import { useLayoutStore } from '../../stores/layout-store';
import { useViewFocus } from '../../stores/view-focus-store';

/** Search box state; kept outside the view so it survives switching side views. */
export const useSearchParams = create<{
	params: Record<string, unknown>;
	setParams: (patch: Record<string, unknown>) => void;
}>((set) => ({
	params: {},
	setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
}));

/**
 * Search text pushed in from outside the panel (searchInFiles). `tick` changes on every request so
 * an already-open panel adopts the query even when the same text is requested twice. Focus goes
 * through the shared view-focus request, like the "Show Search" command.
 */
export const useSearchRequest = create<{
	tick: number;
	query: string | null;
	request: (query: string) => void;
}>((set) => ({
	tick: 0,
	query: null,
	request: (query) => set((s) => ({ tick: s.tick + 1, query })),
}));

/**
 * Opens the Search view with `query` as a literal search (e.g. a clicked Markdown #tag). The panel
 * adopts the new query even when it is already open, because the request tick changes.
 */
export function searchInFiles(query: string): void {
	useSearchParams.getState().setParams({ query, regex: false });
	useLayoutStore.getState().showView('search');
	useSearchRequest.getState().request(query);
	useViewFocus.getState().request('search');
}

export function useFileSearch(
	root: string | null,
	query: SearchQuery,
): {
	result: SearchResult | undefined;
	isFetching: boolean;
	/** `result` belongs to the previous query while this one runs. */
	isPlaceholderData: boolean;
	error: Error | null;
	/** Runs the same search again (files may have changed since). */
	refetch: () => void;
} {
	const client = useQueryClient();
	const q = useQuery({
		queryKey: ['search', root, query],
		queryFn: () => call('search:run', query),
		enabled: root !== null && query.query.trim().length > 0,
		// Keep showing the last results while the next query runs (no flicker while typing).
		placeholderData: keepPreviousData,
		staleTime: 5_000,
		retry: false,
	});
	// Edits and saves move lines: re-run so results don't jump to where a match used to be.
	// Marks every cached query of this folder stale; only the visible one re-runs now.
	useFsRefresh(() => void client.invalidateQueries({ queryKey: ['search', root] }));
	// A search replaced by a newer keystroke isn't an error worth showing.
	const cancelled = q.error instanceof IpcCallError && q.error.code === 'SEARCH_CANCELLED';
	return {
		result: q.data,
		isFetching: q.isFetching,
		isPlaceholderData: q.isPlaceholderData,
		error: cancelled ? null : q.error,
		// Failures land in q.error and show in the panel.
		refetch: () => void q.refetch(),
	};
}
