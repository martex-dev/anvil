import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

/** A button on the toast (e.g. Undo); running it also dismisses the toast. */
export interface ToastAction {
	label: string;
	run: () => void;
}

export interface ToastItem {
	id: number;
	title: string;
	description?: string | undefined;
	tone: ToastTone;
	durationMs: number;
	action?: ToastAction | undefined;
	/** How many identical toasts this one stands for (shown as ×n). */
	count: number;
	/** False while it animates out; closed toasts are pruned on the next push. */
	open: boolean;
}

interface ToastState {
	toasts: ToastItem[];
	push: (
		toast: Omit<ToastItem, 'id' | 'durationMs' | 'count' | 'open'> & { durationMs?: number },
	) => number;
	dismiss: (id: number) => void;
}

let nextId = 1;

/** Toasts on screen at once. */
export const MAX_TOASTS = 5;

/**
 * Forgets closed toasts (their exit animation is long over by the next push) and drops the oldest
 * over the cap, errors last so a burst of info can't hide a failure.
 */
function capToasts(toasts: ToastItem[]): ToastItem[] {
	const out = toasts.filter((t) => t.open);
	while (out.length > MAX_TOASTS) {
		const victim = out.findIndex((t) => t.tone !== 'error');
		out.splice(victim === -1 ? 0 : victim, 1);
	}
	return out;
}

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	push: (toast) => {
		const id = nextId++;
		// Errors and toasts with an action stay longer so there's time to read or act on them.
		const durationMs =
			toast.durationMs ?? (toast.tone === 'error' || toast.action ? 8000 : 4000);
		set((s) => {
			// A toast with an action (Undo) is never folded: each one's action undoes its own event.
			const same = s.toasts.find(
				(t) =>
					t.open &&
					!t.action &&
					!toast.action &&
					t.tone === toast.tone &&
					t.title === toast.title &&
					t.description === toast.description,
			);
			// A repeat bumps the count; the new id remounts the toast, restarting its timer.
			if (same)
				return {
					toasts: s.toasts.map((t) =>
						t === same ? { ...t, id, durationMs, count: t.count + 1 } : t,
					),
				};
			const item: ToastItem = { ...toast, id, durationMs, count: 1, open: true };
			return { toasts: capToasts([...s.toasts, item]) };
		});
		return id;
	},
	// Closing keeps the item so Radix can play its exit animation before unmounting it.
	dismiss: (id) =>
		set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, open: false } : t)) })),
}));

/** Imperative helper so non-React code (commands, query callbacks) can raise toasts. */
export const toast = {
	info: (title: string, description?: string, action?: ToastAction) =>
		useToastStore.getState().push({ title, description, tone: 'info', action }),
	success: (title: string, description?: string) =>
		useToastStore.getState().push({ title, description, tone: 'success' }),
	warn: (title: string, description?: string) =>
		useToastStore.getState().push({ title, description, tone: 'warn' }),
	error: (title: string, description?: string) =>
		useToastStore.getState().push({ title, description, tone: 'error' }),
};
