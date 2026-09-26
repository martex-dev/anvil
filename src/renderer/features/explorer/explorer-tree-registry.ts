import type { RefObject } from 'react';

import type { WorkspaceInfo } from '@shared/ipc/channels/workspace';

import { WORKSPACE_KEY } from '../../app/hooks/use-workspace';
import { queryClient } from '../../lib/query-client';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';

/** What the mounted file tree lets the rest of the app (buttons, palette commands) do. */
export interface FileTreeHandle {
	startCreate: (kind: 'file' | 'dir') => void;
	collapseAll: () => void;
	refresh: () => void;
	revealActive: () => void;
	renameFocused: () => void;
	deleteFocused: () => void;
}

type TreeAction = (tree: FileTreeHandle) => void;

let mounted: RefObject<FileTreeHandle | null> | null = null;
let queued: TreeAction | null = null;

/**
 * Called by FileTree when it mounts. Runs an action a command queued while the Explorer was
 * hidden (the tree only exists while its view is shown). Returns the unregister function.
 */
export function registerExplorerTree(ref: RefObject<FileTreeHandle | null>): () => void {
	mounted = ref;
	const action = queued;
	queued = null;
	if (action && ref.current) action(ref.current);
	return () => {
		if (mounted === ref) mounted = null;
	};
}

/** Shows the Explorer and runs `action` on its tree, once it is mounted. */
export function withExplorerTree(action: TreeAction): void {
	const root = queryClient.getQueryData<WorkspaceInfo>(WORKSPACE_KEY)?.root;
	if (!root) {
		toast.warn('Open a folder first');
		return;
	}
	useLayoutStore.getState().showView('explorer');
	const tree = mounted?.current;
	if (tree) action(tree);
	else queued = action;
}
