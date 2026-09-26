import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { call, IpcCallError } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { toast } from '../../stores/toast-store';
import { reasonNotToLeaveWorkspace } from '../../stores/workbench-store';

/** Switching folders must never silently drop unsaved editor changes. */
function guarded(action: () => Promise<unknown>, failure: string): void {
	const reason = reasonNotToLeaveWorkspace();
	if (reason) {
		toast.warn("Can't switch folders yet", reason);
		return;
	}
	action().catch((error: unknown) =>
		toast.error(failure, error instanceof Error ? error.message : undefined),
	);
}

export function openFolderDialog(): void {
	guarded(() => call('workspace:openDialog'), 'Could not open folder');
}

export function openRecentFolder(path: string): void {
	guarded(async () => {
		try {
			await call('workspace:open', path);
		} catch (error) {
			if (!(error instanceof IpcCallError && error.code === 'WORKSPACE_NOT_FOUND'))
				throw error;
			// A moved or deleted project would fail on every click: drop it from the list.
			forgetRecentFolder(path);
			throw new Error(`${error.message}. Removed it from recent folders.`, { cause: error });
		}
	}, 'Could not open folder');
}

export function forgetRecentFolder(path: string): void {
	call('workspace:forgetRecent', path).catch((error: unknown) =>
		toast.error(
			'Could not remove from recent',
			error instanceof Error ? error.message : undefined,
		),
	);
}

export function closeFolder(): void {
	guarded(() => call('workspace:close'), 'Could not close folder');
}

/**
 * Re-lists every folder and file view and restarts the file watcher, which recovers from a
 * watch error (network share, too many files) without reopening the folder.
 */
export function refreshExplorer(): void {
	void queryClient.invalidateQueries({ queryKey: fsKeys.all });
	call('fs:rewatch').catch((error: unknown) =>
		toast.error(
			'Could not restart file watching',
			error instanceof Error ? error.message : undefined,
		),
	);
}
