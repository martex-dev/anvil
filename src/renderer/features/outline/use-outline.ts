import { useMemo } from 'react';

import { focusedEditor } from '../../lib/monaco/editors';
import { useTabsStore } from '../../stores/tabs-store';
import { useEditorStore } from '../editor/editor-store';
import { outlineFor, type OutlineSymbol } from './outline';

/** Outline of the focused code editor; recomputed when its text or file changes. */
export function useOutline(): { path: string | null; symbols: OutlineSymbol[] } {
	const version = useEditorStore((s) => s.contentVersion);
	const active = useEditorStore((s) => s.active);
	const language = useEditorStore((s) => s.cursor?.language ?? null);
	const focusedGroup = useTabsStore((s) => s.focused);
	const activeTab = useTabsStore((s) => s.groups.find((g) => g.id === s.focused)?.active ?? null);
	return useMemo(() => {
		const model = focusedEditor()?.getModel();
		if (!model) return { path: null, symbols: [] };
		return {
			path: active,
			symbols: outlineFor(model.getLanguageId(), model.getLinesContent()),
		};
		// The deps are the signals that the focused model or its text changed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [version, active, language, focusedGroup, activeTab]);
}
