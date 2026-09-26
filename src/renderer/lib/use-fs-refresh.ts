import { useEffect, useRef } from 'react';

import { useAnvilEvent } from './use-anvil-event';

/**
 * Calls `refresh` once files on disk have settled after a change. Debounced on top of the
 * watcher's own batching: a save plus a formatter run (or a git checkout) arrives as several
 * batches, and each refresh here re-runs a whole-folder ripgrep.
 */
export function useFsRefresh(refresh: () => void, delayMs = 500): void {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);
	useAnvilEvent('fs:changed', () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			timer.current = null;
			refresh();
		}, delayMs);
	});
}
