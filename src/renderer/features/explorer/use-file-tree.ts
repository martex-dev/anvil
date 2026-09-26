import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { call } from '../../lib/ipc';
import { buildRows, type DirState, type PendingCreate, type TreeRow } from './tree-model';

export interface FileTree {
	rows: TreeRow[];
	expanded: ReadonlySet<string>;
	toggle: (dir: string) => void;
	expand: (dirs: string[]) => void;
	collapseAll: () => void;
	isRootLoading: boolean;
	rootError: Error | null;
	refetchAll: () => void;
}

interface Listing {
	data: FsEntry[] | undefined;
	error: Error | null;
	isLoading: boolean;
}

/**
 * Keeps only what the tree reads. `useQueries` returns a new array every render, but a
 * `combine` result is structurally shared, so the memoized rows below only rebuild when a
 * listing actually changes (not on every focus move). Module-level so its identity is stable.
 */
function pickListing(results: UseQueryResult<FsEntry[]>[]): Listing[] {
	return results.map((q) => ({ data: q.data, error: q.error, isLoading: q.isLoading }));
}

/** Lazily lists the root and every expanded folder, and flattens them into rows. */
export function useFileTree(root: string, pending: PendingCreate | null): FileTree {
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
	const dirs = useMemo(() => ['', ...expanded], [expanded]);

	const client = useQueryClient();
	const queries = useQueries({
		queries: dirs.map((dir) => ({
			queryKey: fsKeys.list(root, dir),
			queryFn: () => call('fs:list', dir),
			staleTime: Infinity,
		})),
		combine: pickListing,
	});

	const states = useMemo(() => {
		const map = new Map<string, DirState>();
		dirs.forEach((dir, i) => {
			const q = queries[i];
			if (!q) return;
			map.set(dir, {
				...(q.data ? { entries: q.data } : {}),
				...(q.error ? { error: q.error.message } : {}),
			});
		});
		return map;
	}, [dirs, queries]);

	const rows = useMemo(() => buildRows(states, expanded, pending), [states, expanded, pending]);

	const toggle = useCallback((dir: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(dir)) {
				// Collapsing a folder also collapses everything inside it.
				for (const d of prev) if (d === dir || d.startsWith(`${dir}/`)) next.delete(d);
			} else {
				next.add(dir);
			}
			return next;
		});
	}, []);

	const expand = useCallback((more: string[]) => {
		setExpanded((prev) => new Set([...prev, ...more]));
	}, []);

	return {
		rows,
		expanded,
		toggle,
		expand,
		collapseAll: () => setExpanded(new Set()),
		isRootLoading: queries[0]?.isLoading ?? true,
		rootError: queries[0]?.error ?? null,
		refetchAll: () => {
			for (const dir of dirs) {
				void client.refetchQueries({ queryKey: fsKeys.list(root, dir), exact: true });
			}
		},
	};
}
