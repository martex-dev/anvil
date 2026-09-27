import { create } from 'zustand';

import {
	type DebugAction,
	debugReducer,
	type DebugState,
	INITIAL_DEBUG_STATE,
} from './debug-reducer';

interface DebugStore extends DebugState {
	dispatch: (action: DebugAction) => void;
}

/** The one debug session's state; every view reads it, only session.ts dispatches. */
export const useDebugStore = create<DebugStore>((set) => ({
	...INITIAL_DEBUG_STATE,
	dispatch: (action) => set((s) => debugReducer(s, action)),
}));

export const debugState = (): DebugState => useDebugStore.getState();

export const dispatch = (action: DebugAction): void => useDebugStore.getState().dispatch(action);
