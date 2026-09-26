import { type LayoutState, sanitizeLayout } from '../../stores/layout-store';

const PERSISTED: Array<keyof LayoutState> = [
	'sideView',
	'sideOpen',
	'sideWidth',
	'panelOpen',
	'panelTab',
	'panelHeight',
	'aiOpen',
	'aiWidth',
	'splitRatio',
];

/**
 * Choices a person can make before the saved layout arrives (Ctrl+B, Ctrl+J, a view). Widths
 * are left out: at startup they change on their own as the panes fit the window, and that must
 * not stop the saved sizes from being restored.
 */
const USER_TOGGLES: Array<keyof LayoutState> = [
	'sideView',
	'sideOpen',
	'panelOpen',
	'panelTab',
	'aiOpen',
];

interface LayoutStoreLike {
	getState: () => LayoutState & { hydrate: (saved: Partial<LayoutState>) => void };
	subscribe: (listener: (state: LayoutState, prev: LayoutState) => void) => () => void;
}

interface LayoutPersistenceDeps {
	store: LayoutStoreLike;
	/** The saved layout, or undefined when there is none yet. */
	load: () => Promise<unknown>;
	save: (layout: Record<string, unknown>) => Promise<unknown>;
	warn: (message: string, error: unknown) => void;
	delayMs?: number;
}

/**
 * Restores the saved layout, then saves every change (debounced). A toggle made while the saved
 * layout was still loading wins over it and gets saved, instead of being silently reverted.
 */
export function installLayoutPersistence({
	store,
	load,
	save,
	warn,
	delayMs = 400,
}: LayoutPersistenceDeps): () => void {
	let ready = false;
	let hydrating = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const touched = new Set<keyof LayoutState>();

	const schedule = (): void => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			const s = store.getState();
			const layout = Object.fromEntries(PERSISTED.map((k) => [k, s[k]]));
			save(layout).catch((error: unknown) => warn('save failed', error));
		}, delayMs);
	};

	const off = store.subscribe((s, prev) => {
		if (ready) return schedule();
		if (hydrating) return;
		for (const k of USER_TOGGLES) if (s[k] !== prev[k]) touched.add(k);
	});

	load()
		.then((layout) => {
			if (!layout || typeof layout !== 'object') return;
			const saved = sanitizeLayout(layout as Record<string, unknown>);
			const patch = Object.fromEntries(
				Object.entries(saved).filter(([k]) => !touched.has(k as keyof LayoutState)),
			) as Partial<LayoutState>;
			hydrating = true;
			try {
				store.getState().hydrate(patch);
			} finally {
				hydrating = false;
			}
		})
		.catch((error: unknown) => warn('restore failed', error))
		.finally(() => {
			ready = true;
			if (touched.size > 0) schedule();
		});

	return () => {
		off();
		if (timer) clearTimeout(timer);
	};
}
