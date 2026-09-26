import { useEffect } from 'react';

import { focusedEditor } from '../../lib/monaco/editors';
import { useLayoutStore } from '../../stores/layout-store';
import { installFocusRescue } from './focus-rescue';

function refocus(): void {
	const editor = focusedEditor();
	if (editor) {
		editor.focus();
		return;
	}
	// No code editor to return to: land on the activity bar so Tab navigation still works.
	document.querySelector<HTMLElement>('nav[aria-label="Views"] button')?.focus();
}

/** Keeps keyboard focus alive when a layout toggle hides the focused pane. */
export function useFocusRescue(): void {
	useEffect(
		() =>
			installFocusRescue({
				subscribe: (listener) => useLayoutStore.subscribe(listener),
				doc: document,
				defer: (fn) => requestAnimationFrame(fn),
				refocus,
			}),
		[],
	);
}
