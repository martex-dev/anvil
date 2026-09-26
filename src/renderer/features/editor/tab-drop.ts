import { rlog } from '../../lib/log';
import { useTabsStore } from '../../stores/tabs-store';

/** Which side of the tab under the pointer a dragged tab goes to. */
export type DropSide = 'before' | 'after';

export const TAB_MIME = 'text/anvil-tab';

/** Before when the pointer is over the left half of the target tab, after over the right. */
export function dropSide(clientX: number, rect: { left: number; width: number }): DropSide {
	return clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}

/**
 * The index to pass to `move(group, from, to)` so the tab lands on `side` of the tab at
 * `target`. `move` removes first, so an insert point right of `from` shifts left by one.
 */
export function dropIndex(from: number, target: number, side: DropSide): number {
	const insert = side === 'before' ? target : target + 1;
	return from < insert ? insert - 1 : insert;
}

/** Drops the dragged tab (`raw` is its TAB_MIME payload) next to `targetId` in `group`. */
export function dropTab(raw: string, group: number, targetId: string, side: DropSide): void {
	let from: { id: string; group: number };
	try {
		from = JSON.parse(raw) as { id: string; group: number };
	} catch (error) {
		// Not one of our drags (a malformed payload from elsewhere): nothing to move.
		rlog.warn('editor', 'ignored a malformed tab drop', error);
		return;
	}
	const store = useTabsStore.getState();
	if (from.group !== group) {
		const moved = store.tabs[from.id];
		if (!moved) return;
		store.open(moved, { group });
		store.close(from.group, from.id);
	}
	const g = useTabsStore.getState().groups.find((x) => x.id === group);
	if (!g) return;
	const fromIndex = g.tabIds.indexOf(from.id);
	const target = g.tabIds.indexOf(targetId);
	if (fromIndex === -1 || target === -1 || from.id === targetId) return;
	useTabsStore.getState().move(group, fromIndex, dropIndex(fromIndex, target, side));
}
