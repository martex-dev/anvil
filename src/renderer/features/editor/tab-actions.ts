import { call } from '../../lib/ipc';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { useWorkbenchStore } from '../../stores/workbench-store';

/** Shows the explorer, expands it down to `path` and moves keyboard focus onto that row. */
export function revealInExplorer(path: string): void {
	useLayoutStore.getState().showView('explorer');
	useWorkbenchStore.getState().requestReveal(path);
}

/** Copies a workspace file's path (absolute, as Windows shows it, or folder-relative). */
export async function copyPath(path: string, absolute: boolean): Promise<void> {
	try {
		const text = await call('fs:copyPath', { path, absolute });
		await navigator.clipboard.writeText(text);
		toast.success('Path copied', text);
	} catch (error) {
		toast.error('Could not copy the path', error instanceof Error ? error.message : undefined);
	}
}
