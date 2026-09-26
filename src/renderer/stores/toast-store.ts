import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
	id: number;
	title: string;
	description?: string | undefined;
	tone: ToastTone;
	durationMs: number;
	/** How many identical toasts this one stands for (shown as ×n). */
	count: number;
}

interface ToastState {
	toasts: ToastItem[];
	push: (
		toast: Omit<ToastItem, 'id' | 'durationMs' | 'count'> & { durationMs?: number },
	) => number;
	dismiss: (id: number) => void;
}

let nextId = 1;

/** Toasts on screen at once. */
export const MAX_TOASTS = 5;

/** Drops the oldest toasts over the cap, errors last so a burst of info can't hide a failure. */
function capToasts(toasts: ToastItem[]): ToastItem[] {
	const out = [...toasts];
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
		const durationMs = toast.durationMs ?? (toast.tone === 'error' ? 8000 : 4000);
		set((s) => {
			const same = s.toasts.find(
				(t) =>
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
			return { toasts: capToasts([...s.toasts, { ...toast, id, durationMs, count: 1 }]) };
		});
		return id;
	},
	dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper so non-React code (commands, query callbacks) can raise toasts. */
export const toast = {
	info: (title: string, description?: string) =>
		useToastStore.getState().push({ title, description, tone: 'info' }),
	success: (title: string, description?: string) =>
		useToastStore.getState().push({ title, description, tone: 'success' }),
	warn: (title: string, description?: string) =>
		useToastStore.getState().push({ title, description, tone: 'warn' }),
	error: (title: string, description?: string) =>
		useToastStore.getState().push({ title, description, tone: 'error' }),
};
