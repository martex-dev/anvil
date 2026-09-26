import { useEffect, useState } from 'react';

import { useEditorStore } from '../../features/editor/editor-store';

/** vim-style mode names for where the keyboard is: the status line's first block. */
export type Mode = 'NRM' | 'INS' | 'VIS' | 'TRM' | 'CMD';

function modeOf(el: Element | null): Exclude<Mode, 'VIS'> {
	if (!el) return 'NRM';
	if (el.closest('.monaco-editor')) return 'INS';
	if (el.closest('.xterm')) return 'TRM';
	if (el.closest('[cmdk-root], [role="dialog"], [role="menu"]')) return 'CMD';
	return 'NRM';
}

/** Follows focus around the window; an editor with a selection reads as VISUAL. */
export function useMode(): Mode {
	const [mode, setMode] = useState<Exclude<Mode, 'VIS'>>(() => modeOf(document.activeElement));
	const selected = useEditorStore((s) => (s.cursor?.selected ?? 0) > 0);
	useEffect(() => {
		// focusout fires before focus lands elsewhere; read activeElement a tick later.
		const update = (): void => {
			requestAnimationFrame(() => setMode(modeOf(document.activeElement)));
		};
		document.addEventListener('focusin', update);
		document.addEventListener('focusout', update);
		return () => {
			document.removeEventListener('focusin', update);
			document.removeEventListener('focusout', update);
		};
	}, []);
	return mode === 'INS' && selected ? 'VIS' : mode;
}
