import { create } from 'zustand';

const KEY = 'anvil.debug.watch';

function load(): string[] {
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		// Storage blocked or a corrupt value: start without watches.
		return [];
	}
}

interface WatchState {
	expressions: string[];
	add: (expression: string) => void;
	remove: (index: number) => void;
}

/** Watch expressions, kept across sessions (they are about your code, not one run). */
export const useWatches = create<WatchState>((set) => ({
	expressions: typeof localStorage === 'undefined' ? [] : load(),
	add: (expression) =>
		set((s) => {
			const e = expression.trim();
			return e && !s.expressions.includes(e) ? { expressions: [...s.expressions, e] } : s;
		}),
	remove: (index) => set((s) => ({ expressions: s.expressions.filter((_, i) => i !== index) })),
}));

useWatches.subscribe((s) => {
	try {
		localStorage.setItem(KEY, JSON.stringify(s.expressions));
	} catch {
		// Losing watches on a full storage is acceptable.
	}
});
