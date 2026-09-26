import { useLayoutStore } from '../../stores/layout-store';
import { useWorkbenchStore } from '../../stores/workbench-store';

/** Shows the explorer, expands it down to `path` and moves keyboard focus onto that row. */
export function revealInExplorer(path: string): void {
	useLayoutStore.getState().showView('explorer');
	useWorkbenchStore.getState().requestReveal(path);
}
