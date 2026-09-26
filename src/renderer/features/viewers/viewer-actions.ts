import { useEffect } from 'react';

import { type DiffPayload, focusedTab, useTabsStore } from '../../stores/tabs-store';

/** What the palette can do to each kind of viewer; every mounted viewer registers its own. */
export interface ViewerActions {
	image: {
		zoomIn: () => void;
		zoomOut: () => void;
		fit: () => void;
		actualSize: () => void;
		reload: () => void;
	};
	notebook: {
		toggleOutputs: () => void;
		convert: () => void;
		reload: () => void;
	};
	markdown: {
		reload: () => void;
		editSource: () => void;
	};
	diff: {
		toggleInline: () => void;
	};
}

export type ViewerKind = keyof ViewerActions;

/** File viewers are keyed by path; diff tabs have none, so by the payload the tab holds. */
type ViewerKey = string | DiffPayload;

/**
 * The viewers are lazy-loaded, so commands reach them through here instead of importing them.
 * Two groups showing the same file act on the same viewer, as with data tables.
 */
const registries: { [K in ViewerKind]: Map<ViewerKey, ViewerActions[K]> } = {
	image: new Map(),
	notebook: new Map(),
	markdown: new Map(),
	diff: new Map(),
};

export function registerViewer<K extends ViewerKind>(
	kind: K,
	key: ViewerKey,
	actions: ViewerActions[K],
): () => void {
	const registry: Map<ViewerKey, ViewerActions[K]> = registries[kind];
	registry.set(key, actions);
	return () => {
		if (registry.get(key) === actions) registry.delete(key);
	};
}

/** Re-registers every render so palette commands always see the viewer's current state. */
export function useViewerActions<K extends ViewerKind>(
	kind: K,
	key: ViewerKey,
	actions: ViewerActions[K],
): void {
	useEffect(() => registerViewer(kind, key, actions));
}

/** The viewer of this kind in front of the focused editor group, if there is one. */
export function activeViewer<K extends ViewerKind>(kind: K): ViewerActions[K] | null {
	const tab = focusedTab(useTabsStore.getState());
	if (!tab || tab.kind !== kind) return null;
	const key = kind === 'diff' ? tab.diff : tab.path;
	if (!key) return null;
	const registry: Map<ViewerKey, ViewerActions[K]> = registries[kind];
	return registry.get(key) ?? null;
}
