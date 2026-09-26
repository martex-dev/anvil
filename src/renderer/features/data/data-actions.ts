import { focusedTab, useTabsStore } from '../../stores/tabs-store';

/** What the palette can do to an open table; each DataViewer registers its own. */
export interface DataViewerActions {
	focusFilter: () => void;
	clearFilter: () => void;
	copyCsv: () => void;
	reload: () => void;
	toggleProfile: () => void;
	openAsText: () => void;
	clearSort: () => void;
}

/**
 * Keyed by path: a data tab's id is derived from its path, and two groups showing the same
 * file act on the same table. The viewer is lazy-loaded, so commands reach it through here
 * instead of importing it.
 */
const viewers = new Map<string, DataViewerActions>();

export function registerDataViewer(path: string, actions: DataViewerActions): () => void {
	viewers.set(path, actions);
	return () => {
		if (viewers.get(path) === actions) viewers.delete(path);
	};
}

/** The table in front of the focused editor group, if that tab is a data viewer. */
export function activeDataViewer(): DataViewerActions | null {
	const tab = focusedTab(useTabsStore.getState());
	if (tab?.kind !== 'data' || !tab.path) return null;
	return viewers.get(tab.path) ?? null;
}
