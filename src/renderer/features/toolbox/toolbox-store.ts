import { useCallback } from 'react';
import { create } from 'zustand';

interface ToolboxFieldsState {
	fields: Readonly<Record<string, unknown>>;
	setField: (key: string, value: unknown) => void;
}

/**
 * Tool inputs, kept outside the components so they survive the toolbox unmounting when the
 * side bar switches view or closes. Memory only, never persisted: a pasted JWT must not reach
 * disk.
 */
export const useToolboxStore = create<ToolboxFieldsState>((set) => ({
	fields: {},
	setField: (key, value) => set((s) => ({ fields: { ...s.fields, [key]: value } })),
}));

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
