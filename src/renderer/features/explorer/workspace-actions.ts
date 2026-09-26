import { call } from '../../lib/ipc';
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
	guarded(() => call('workspace:open', path), 'Could not open folder');
}

export function closeFolder(): void {
	guarded(() => call('workspace:close'), 'Could not close folder');
}
