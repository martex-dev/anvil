import { create } from 'zustand';

/** Autocomplete activity for the status bar: busy while a suggestion is in flight. */
export const useGhostStatus = create<{
	busy: boolean;
	error: string | null;
	set: (patch: { busy?: boolean; error?: string | null }) => void;
}>((set) => ({
	busy: false,
	error: null,
	set: (patch) => set(patch),
}));
