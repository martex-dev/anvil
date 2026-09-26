import { type RefObject, useEffect } from 'react';
import { create } from 'zustand';

import type { SideView } from './layout-store';

interface ViewFocusState {
	/** The view whose "Show …" command asked for focus and hasn't taken it yet. */
	pending: SideView | null;
	/** Bumped on every request so an already-mounted view re-focuses on a repeated command. */
	tick: number;
	request: (view: SideView) => void;
	/** True (and clears the request) when `view` is the one waiting for focus. */
	consume: (view: SideView) => boolean;
}

/**
 * Focus requests from the view commands (Ctrl+Shift+E, Ctrl+Shift+J, …). Showing a side view
 * only mounts it; without this the keyboard stays in the editor and typing edits code.
 */
export const useViewFocus = create<ViewFocusState>((set, get) => ({
	pending: null,
	tick: 0,
	request: (view) => set((s) => ({ pending: view, tick: s.tick + 1 })),
	consume: (view) => {
		if (get().pending !== view) return false;
		set({ pending: null });
		return true;
	},
}));

/**
 * Focuses `ref` when `view` was shown by its command, either right away (already mounted) or once
 * the element exists (`ready`), e.g. after a loading state. Text inputs get their text selected so
 * typing replaces the previous query.
 */
export function useFocusOnViewRequest(
	view: SideView,
	ref: RefObject<HTMLElement | null>,
	ready = true,
): void {
	const tick = useViewFocus((s) => (s.pending === view ? s.tick : 0));
	useEffect(() => {
		const el = ref.current;
		if (tick === 0 || !ready || !el) return;
		if (!useViewFocus.getState().consume(view)) return;
		el.focus({ preventScroll: true });
		if (el instanceof HTMLInputElement) el.select();
	}, [tick, ready, view, ref]);
}
