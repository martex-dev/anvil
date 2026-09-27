import { createContext, useContext } from 'react';

/**
 * Side views stay mounted once visited (so they keep their state) but only one is on screen.
 * Views that do background work (a folder-wide ripgrep on every file change) read this to pause
 * it while hidden. True outside the side bar.
 */
export const SideViewVisibleContext = createContext(true);

export function useSideViewVisible(): boolean {
	return useContext(SideViewVisibleContext);
}
