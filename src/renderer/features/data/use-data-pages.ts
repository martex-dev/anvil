import {
	keepPreviousData,
	type QueryClient,
	useQueries,
	useQuery,
	type UseQueryResult,
} from '@tanstack/react-query';

import type { DataPage } from '@shared/ipc/channels/data';

import { call } from '../../lib/ipc';
import { PAGE_SIZE, pagesForRange, type SortState } from './data-format';

export interface DataParams {
	path: string;
	filter: string;
	sort: SortState | null;
}

type Row = (string | null)[];

export function pageKey(params: DataParams, page: number): readonly unknown[] {
	return [
		'data',
		'page',
		params.path,
		params.filter,
		params.sort?.column ?? -1,
		params.sort?.desc ?? false,
		page,
	];
}

function pageQuery(
	params: DataParams,
	page: number,
): {
	queryKey: readonly unknown[];
	queryFn: () => Promise<DataPage>;
} {
	return {
		queryKey: pageKey(params, page),
		queryFn: () =>
			call('data:page', {
				path: params.path,
				offset: page * PAGE_SIZE,
				limit: PAGE_SIZE,
				sort: params.sort,
				filter: params.filter,
			}),
	};
}

/**
 * Page 0 doubles as the table's metadata (columns, row count). Keeping the previous result
 * while a new filter/sort loads stops the grid from flashing to a spinner on every keystroke.
 */
export function useDataMeta(params: DataParams): UseQueryResult<DataPage> {
	return useQuery({ ...pageQuery(params, 0), placeholderData: keepPreviousData });
}

export type RowLookup = (row: number) => Row | 'loading' | 'error';

/** A page of rows that failed to load, with a way to try it again. */
export interface PageFailure {
	page: number;
	message: string;
	retry: () => void;
}

export interface RowPages {
	getRow: RowLookup;
	/** Pages near the viewport whose request failed; their rows render as errors. */
	failures: PageFailure[];
}

/** Fetches (and caches, via TanStack Query) the pages overlapping [start, end). */
export function useRowPages(
	params: DataParams,
	start: number,
	end: number,
	enabled: boolean,
): RowPages {
	// Reach a little past the viewport so scrolling across a page boundary is already loaded.
	const pages = pagesForRange(Math.max(0, start - 100), end + 100);
	const results = useQueries({
		queries: pages.map((page) => ({ ...pageQuery(params, page), enabled })),
	});
	const byPage = new Map<number, UseQueryResult<DataPage>>();
	const failures: PageFailure[] = [];
	pages.forEach((page, i) => {
		const result = results[i];
		if (!result) return;
		byPage.set(page, result);
		if (result.isError)
			failures.push({
				page,
				message: result.error.message,
				retry: () => void result.refetch(),
			});
	});
	const getRow: RowLookup = (row) => {
		const result = byPage.get(Math.floor(row / PAGE_SIZE));
		if (!result || result.isPending) return 'loading';
		if (result.isError) return 'error';
		return result.data.rows[row % PAGE_SIZE] ?? 'loading';
	};
	return { getRow, failures };
}

/** Rows [start, end] inclusive, reusing cached pages; used for clipboard export. */
export async function fetchRows(
	client: QueryClient,
	params: DataParams,
	start: number,
	end: number,
): Promise<Row[]> {
	const pages = pagesForRange(start, end + 1);
	const loaded = await Promise.all(
		pages.map((page) => client.fetchQuery(pageQuery(params, page))),
	);
	const rows: Row[] = [];
	loaded.forEach((data, i) => {
		const base = (pages[i] ?? 0) * PAGE_SIZE;
		data.rows.forEach((row, j) => {
			const index = base + j;
			if (index >= start && index <= end) rows.push(row);
		});
	});
	return rows;
}
