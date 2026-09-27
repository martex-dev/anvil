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

let inFlight = 0;

/**
 * Marks one completion request as in flight; call the returned function once it settles.
 * Requests overlap (typing cancels one while the next starts, and the cancelled one settles
 * later), so busy stays on until the last of them is done, not the first.
 */
export function beginGhostRequest(): () => void {
	inFlight++;
	useGhostStatus.getState().set({ busy: true });
	let settled = false;
	return () => {
		if (settled) return;
		settled = true;
		inFlight--;
		if (inFlight === 0) useGhostStatus.getState().set({ busy: false });
	};
}
