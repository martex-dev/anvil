import { useEffect } from 'react';

import { useLayoutStore } from '../../stores/layout-store';
import { useOverlayStore } from '../../stores/overlay-store';

/**
 * Escape leaves zen mode. Bubble phase and only when nothing handled the key first: Monaco's
 * find widget, suggest list and the open dialogs all use Escape. The terminal is skipped because
 * Escape belongs to the program running there (vim, less).
 */
export function useZenEscape(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key !== 'Escape' || event.defaultPrevented) return;
			if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
			if (!useLayoutStore.getState().zen) return;
			if (useOverlayStore.getState().open.size > 0) return;
			if (event.target instanceof Element && event.target.closest('.xterm')) return;
			useLayoutStore.getState().toggleZen();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);
}
