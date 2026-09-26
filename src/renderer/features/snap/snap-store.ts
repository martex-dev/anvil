import { create } from 'zustand';

export interface SnapRequest {
	code: string;
	language: string;
	/** File name shown in the window chrome and used for the PNG name. */
	title: string;
	/** Source line of the first snapped line, so line numbers match the file. Defaults to 1. */
	startLine?: number;
}

interface SnapState {
	request: SnapRequest | null;
	/** Bumped on every open so the dialog starts fresh even for an identical request. */
	nonce: number;
	openSnap: (request: SnapRequest) => void;
	closeSnap: () => void;
}

export const useSnap = create<SnapState>((set) => ({
	request: null,
	nonce: 0,
	openSnap: (request) => set((s) => ({ request, nonce: s.nonce + 1 })),
	closeSnap: () => set({ request: null }),
}));
