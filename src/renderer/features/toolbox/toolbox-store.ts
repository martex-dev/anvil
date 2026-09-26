import { useCallback } from 'react';
import { create } from 'zustand';

import { useLayoutStore } from '../../stores/layout-store';
import { isToolId, type ToolId, TOOLS } from './tool-list';

interface ToolboxState {
	/** The selected tool; the only thing remembered across restarts. */
	activeTool: ToolId;
	fields: Readonly<Record<string, unknown>>;
	setActiveTool: (id: ToolId) => void;
	setField: (key: string, value: unknown) => void;
}

const STORAGE_KEY = 'anvil.toolbox.lastTool';

function loadLastTool(): ToolId {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved && isToolId(saved)) return saved;
	} catch {
		// Storage can be unavailable (blocked or quota); the first tool is a fine default.
	}
	return TOOLS[0]?.id ?? 'time';
}

function saveLastTool(id: ToolId): void {
	try {
		localStorage.setItem(STORAGE_KEY, id);
	} catch {
		// Remembering the tool is a convenience; losing it is harmless.
	}
}

/**
 * Toolbox state, kept outside the components so it survives the toolbox unmounting when the
 * side bar switches view or closes. Tool inputs are memory only, never persisted: a pasted JWT
 * must not reach disk.
 */
export const useToolboxStore = create<ToolboxState>((set) => ({
	activeTool: loadLastTool(),
	fields: {},
	setActiveTool: (activeTool) => {
		saveLastTool(activeTool);
		set({ activeTool });
	},
	setField: (key, value) => set((s) => ({ fields: { ...s.fields, [key]: value } })),
}));

/** Shows the toolbox in the side bar with `id` selected (used by the palette commands). */
export function openTool(id: ToolId): void {
	useToolboxStore.getState().setActiveTool(id);
	useLayoutStore.getState().showView('toolbox');
}

/**
 * useState for one toolbox field. `key` names a single field ('jwt.token'), so one key is only
 * ever written with one type; that is what makes reading it back as `T` safe.
 */
export function useToolField<T>(key: string, initial: T): [T, (value: T) => void] {
	const has = useToolboxStore((s) => key in s.fields);
	const stored = useToolboxStore((s) => s.fields[key]);
	const setField = useToolboxStore((s) => s.setField);
	const setValue = useCallback((value: T) => setField(key, value), [key, setField]);
	return [has ? (stored as T) : initial, setValue];
}
