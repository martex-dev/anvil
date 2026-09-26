import { useEffect } from 'react';

import { useLayoutStore } from '../../stores/layout-store';

/**
 * Keeps the side and AI panes inside the window: on start (the saved layout may come from a
 * bigger monitor) and whenever the window shrinks, so the editor column never collapses.
 */
export function useFitPanesToWindow(): void {
	useEffect(() => {
		const fit = (): void => useLayoutStore.getState().fitToViewport();
		fit();
		window.addEventListener('resize', fit);
		return () => window.removeEventListener('resize', fit);
	}, []);
}
