import { useQuery } from '@tanstack/react-query';

import type { WorkspaceInfo } from '@shared/ipc/channels/workspace';

import { call } from '../../lib/ipc';

export const WORKSPACE_KEY = ['workspace'] as const;

const EMPTY: WorkspaceInfo = { root: null, name: null, recent: [] };

/** The open folder. Kept live by the shell's `workspace:changed` handler (useFsInvalidation). */
export function useWorkspace(): { info: WorkspaceInfo; isLoading: boolean; error: Error | null } {
	const query = useQuery({ queryKey: WORKSPACE_KEY, queryFn: () => call('workspace:get') });
	return { info: query.data ?? EMPTY, isLoading: query.isLoading, error: query.error };
}
