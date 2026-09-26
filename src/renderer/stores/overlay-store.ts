import { useEffect, useId } from 'react';
import { create } from 'zustand';

/**
 * Tracks every open overlay (palette, dialog, select menu…). Native WebContentsViews render
 * above all HTML, so webviews must hide while `count > 0` (see CLAUDE.md §11).
 */
interface OverlayState {
	open: Set<string>;
	add: (id: string) => void;
	remove: (id: string) => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
	open: new Set(),
	add: (id) =>
		set((s) => {
			if (s.open.has(id)) return s;
			const open = new Set(s.open);
			open.add(id);
			return { open };
		}),
	remove: (id) =>
		set((s) => {
			if (!s.open.has(id)) return s;
			const open = new Set(s.open);
			open.delete(id);
			return { open };
		}),
}));

export function useAnyOverlayOpen(): boolean {
	return useOverlayStore((s) => s.open.size > 0);
}

/** Registers the calling component as an open overlay while `isOpen` is true. */
export function useRegisterOverlay(isOpen: boolean): void {
	const id = useId();
	useEffect(() => {
		if (!isOpen) return;
		const { add, remove } = useOverlayStore.getState();
		add(id);
		return () => remove(id);
	}, [id, isOpen]);
}
