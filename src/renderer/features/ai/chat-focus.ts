import { create } from 'zustand';

/** Bumped by "Ask AI" commands so the chat input takes focus even when the panel is open. */
export const useChatFocus = create<{ tick: number; focus: () => void }>((set) => ({
	tick: 0,
	focus: () => set((s) => ({ tick: s.tick + 1 })),
}));
