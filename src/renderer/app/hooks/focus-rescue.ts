import type { LayoutState } from '../../stores/layout-store';

type Visibility = Pick<LayoutState, 'sideOpen' | 'panelOpen' | 'aiOpen' | 'zen' | 'panelMaximized'>;

interface FocusRescueDeps {
	/** Subscribes to layout changes; returns an unsubscribe. */
	subscribe: (listener: (state: Visibility, prev: Visibility) => void) => () => void;
	doc: Pick<Document, 'activeElement' | 'body'>;
	/** Runs after React has committed the layout change (requestAnimationFrame in the app). */
	defer: (fn: () => void) => void;
	/** Moves focus somewhere useful (the editor, else a landmark). */
	refocus: () => void;
}

const hidesSomething = (s: Visibility, p: Visibility): boolean =>
	(p.sideOpen && !s.sideOpen) ||
	(p.panelOpen && !s.panelOpen) ||
	(p.aiOpen && !s.aiOpen) ||
	(!p.zen && s.zen) ||
	p.panelMaximized !== s.panelMaximized;

/**
 * When a layout toggle unmounts the pane that holds keyboard focus (Ctrl+J in the terminal,
 * Ctrl+B in the explorer), the browser drops focus to <body> and the next keystrokes go
 * nowhere. This notices the focused element was removed and hands focus back to the editor.
 */
export function installFocusRescue({
	subscribe,
	doc,
	defer,
	refocus,
}: FocusRescueDeps): () => void {
	return subscribe((state, prev) => {
		if (!hidesSomething(state, prev)) return;
		const before = doc.activeElement;
		if (!before || before === doc.body) return;
		defer(() => {
			const now = doc.activeElement;
			if (!before.isConnected && (!now || now === doc.body)) refocus();
		});
	});
}
