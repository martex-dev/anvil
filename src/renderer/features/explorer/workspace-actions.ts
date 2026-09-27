import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { call, IpcCallError } from '../../lib/ipc';
import { queryClient } from '../../lib/query-client';
import { toast } from '../../stores/toast-store';
import { confirmLeave } from '../../stores/workbench-store';

/**
 * Switching folders must never silently drop unsaved editor changes: unsaved files get a
 * Save / Don't Save / Cancel prompt first.
 */
function guarded(action: () => Promise<unknown>, failure: string, verb: string): void {
	void confirmLeave(verb)
		.then((ok) => (ok ? action() : undefined))
		.catch((error: unknown) =>
			toast.error(failure, error instanceof Error ? error.message : undefined),
		);
}

export function openFolderDialog(): void {
	guarded(() => call('workspace:openDialog'), 'Could not open folder', 'opening another folder');
}

export function openRecentFolder(path: string): void {
	guarded(
		async () => {
			try {
				await call('workspace:open', path);
			} catch (error) {
				if (!(error instanceof IpcCallError && error.code === 'WORKSPACE_NOT_FOUND'))
					throw error;
				// A moved or deleted project would fail on every click: drop it from the list.
				forgetRecentFolder(path);
				throw new Error(`${error.message}. Removed it from recent folders.`, {
					cause: error,
				});
			}
		},
		'Could not open folder',
		'switching folders',
	);
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
	guarded(() => call('workspace:close'), 'Could not close folder', 'closing the folder');
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
