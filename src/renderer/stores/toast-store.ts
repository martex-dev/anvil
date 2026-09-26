import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
	id: number;
	title: string;
	description?: string | undefined;
	tone: ToastTone;
	durationMs: number;
}

interface ToastState {
	toasts: ToastItem[];
	push: (toast: Omit<ToastItem, 'id' | 'durationMs'> & { durationMs?: number }) => number;
	dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	push: (toast) => {
		const id = nextId++;
		const durationMs = toast.durationMs ?? (toast.tone === 'error' ? 8000 : 4000);
		set((s) => ({ toasts: [...s.toasts.slice(-4), { ...toast, id, durationMs }] }));
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
