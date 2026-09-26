import { type Query, useQueryClient } from '@tanstack/react-query';

import { touchesTaskFiles } from '../../features/python/task-files';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { WORKSPACE_KEY } from './use-workspace';

/**
 * File query keys include the workspace root. Switching folders therefore uses fresh keys
 * instead of deleting caches — deleting raced with panels mounting for the new folder and left
 * them observing a removed query (stuck on "Loading").
 */
export const fsKeys = {
	all: ['fs'] as const,
	list: (root: string, dir: string) => ['fs', root, 'list', dir] as const,
	file: (root: string, path: string) => ['fs', root, 'file', path] as const,
};

const matches =
	(kind: 'list' | 'file', paths: ReadonlySet<string>) =>
	(q: Query): boolean =>
		q.queryKey[0] === 'fs' && q.queryKey[2] === kind && paths.has(String(q.queryKey[3]));

/** Mounted once by the shell: keeps every module's file caches in sync with main. */
export function useFsInvalidation(): void {
	const client = useQueryClient();
	useAnvilEvent('workspace:changed', (info) => client.setQueryData(WORKSPACE_KEY, info));
	useAnvilEvent('fs:changed', (batch) => {
		const { dirs, files } = batch;
		// Watcher paths are relative to the current root; stale roots' queries are unobserved.
		if (dirs.length > 0)
			void client.invalidateQueries({ predicate: matches('list', new Set(dirs)) });
		if (files.length > 0)
			void client.invalidateQueries({ predicate: matches('file', new Set(files)) });
		// New or removed scripts must show up in the Run view without a manual rescan.
		if (touchesTaskFiles(batch)) void client.invalidateQueries({ queryKey: ['tasks'] });
	});
}
