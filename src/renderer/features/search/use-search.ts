import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import type { SearchQuery, SearchResult } from '@shared/ipc/channels/search';

import { call, IpcCallError } from '../../lib/ipc';
import { useFsRefresh } from '../../lib/use-fs-refresh';

/** Search box state; kept outside the view so it survives switching side views. */
export const useSearchParams = create<{
	params: Record<string, unknown>;
	setParams: (patch: Record<string, unknown>) => void;
}>((set) => ({
	params: {},
	setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
}));

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
