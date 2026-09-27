import { create } from 'zustand';

export const SIDE_VIEWS = [
	'explorer',
	'search',
	'git',
	'run',
	'tests',
	'debug',
	'outline',
	'todos',
	'history',
	'snippets',
	'toolbox',
] as const;
export type SideView = (typeof SIDE_VIEWS)[number];

export const PANEL_TABS = ['terminal', 'problems', 'variables', 'debug'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

export interface LayoutState {
	sideView: SideView;
	sideOpen: boolean;
	sideWidth: number;
	panelOpen: boolean;
	panelTab: PanelTab;
	panelHeight: number;
	/** Bottom panel fills the editor area (terminal-heavy work). */
	panelMaximized: boolean;
	aiOpen: boolean;
	aiWidth: number;
	zen: boolean;
	/** Width share of the left editor group when split, 0.2 – 0.8. */
	splitRatio: number;
	/**
	 * The skin shows the side bar as a drawer over the editor. Set by the workbench from the
	 * look, never persisted: a drawer starts put away and takes no width from the editor.
	 */
	sideDrawer: boolean;
}

interface LayoutActions {
	/** Opens a side view; the same view again collapses the side bar (activity bar behaviour). */
	toggleView: (view: SideView) => void;
	showView: (view: SideView) => void;
	toggleSide: () => void;
	togglePanel: (tab?: PanelTab) => void;
	showPanel: (tab: PanelTab) => void;
	toggleMaximizePanel: () => void;
	/** Opening the AI panel leaves zen mode, which would otherwise hide it. */
	toggleAi: (open?: boolean) => void;
	toggleZen: () => void;
	resize: (
		patch: Partial<Pick<LayoutState, 'sideWidth' | 'panelHeight' | 'aiWidth' | 'splitRatio'>>,
	) => void;
	/** Applies a saved layout; under a drawer skin the side bar stays put away. */
	hydrate: (saved: Partial<LayoutState>) => void;
	/** Re-fits the side, AI and bottom panes after the window was resized. */
	fitToViewport: () => void;
	/** The skin switched between a docked side bar and a drawer; a drawer starts closed. */
	setSideDrawer: (drawer: boolean) => void;
}

export const LAYOUT_DEFAULTS: LayoutState = {
	sideView: 'explorer',
	sideOpen: true,
	sideWidth: 272,
	panelOpen: true,
	panelTab: 'terminal',
	panelHeight: 240,
	panelMaximized: false,
	aiOpen: true,
	aiWidth: 380,
	zen: false,
	splitRatio: 0.5,
	sideDrawer: false,
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Activity bar, gutters and splitters around the panes, in px. */
const CHROME_WIDTH = 80;
/** The editor column never gets narrower than this because of the side or AI pane. */
export const MIN_EDITOR_WIDTH = 320;
const MIN_SIDE = 180;
const MIN_AI = 280;

/** Allowed range of each resizable pane: px, or the left group's share for `splitRatio`. */
export const PANE_LIMITS = {
	sideWidth: { min: MIN_SIDE, max: 640 },
	panelHeight: { min: 120, max: 900 },
	aiWidth: { min: MIN_AI, max: 900 },
	splitRatio: { min: 0.2, max: 0.8 },
} as const;

/** Title bar, status bar and the panel's tab strip, in px. */
const CHROME_HEIGHT = 110;
/** The editor keeps a few lines visible however tall the bottom panel was saved. */
export const MIN_EDITOR_HEIGHT = 160;

export interface Viewport {
	width: number;
	height: number;
}

// Unit tests run without a window: nothing to fit against.
const currentViewport = (): Viewport =>
	typeof window === 'undefined'
		? { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY }
		: { width: window.innerWidth, height: window.innerHeight };

/**
 * Caps the bottom panel so the editor above it keeps MIN_EDITOR_HEIGHT in a window `height` px
 * tall: a panel saved at 900 px on a 1440p monitor would otherwise leave no editor on a
 * 1366x768 laptop. Never below the panel's own minimum.
 */
export function fitPanelHeight(s: LayoutState, height: number): Partial<LayoutState> {
	const max = Math.max(PANE_LIMITS.panelHeight.min, height - CHROME_HEIGHT - MIN_EDITOR_HEIGHT);
	return s.panelHeight > max ? { panelHeight: max } : {};
}

/** Width and height fits together, for every change and every window resize. */
export function fitPanes(
	s: LayoutState,
	view: Viewport,
	first: 'side' | 'ai' = 'ai',
): Partial<LayoutState> {
	return { ...fitWidths(s, view.width, first), ...fitPanelHeight(s, view.height) };
}

/**
 * Shrinks the visible side and AI panes so the editor column keeps MIN_EDITOR_WIDTH in a window
 * of `viewport` px. `first` gives way first: the pane being dragged (so a drag stops at the limit
 * instead of pushing the other pane), else the AI pane. Panes never go below their own minimum,
 * so a tiny window may still overflow.
 */
export function fitWidths(
	s: LayoutState,
	viewport: number,
	first: 'side' | 'ai' = 'ai',
): Partial<LayoutState> {
	if (s.zen) return {};
	// A drawer floats over the editor, so it takes no width from it.
	const sideDocked = s.sideOpen && !s.sideDrawer;
	let side = sideDocked ? s.sideWidth : 0;
	let ai = s.aiOpen ? s.aiWidth : 0;
	let over = side + ai + CHROME_WIDTH + MIN_EDITOR_WIDTH - viewport;
	if (over <= 0) return {};
	const shrink = (width: number, min: number): number => {
		const cut = Math.min(over, Math.max(0, width - min));
		over -= cut;
		return width - cut;
	};
	if (first === 'ai') {
		if (s.aiOpen) ai = shrink(ai, MIN_AI);
		if (sideDocked) side = shrink(side, MIN_SIDE);
	} else {
		if (sideDocked) side = shrink(side, MIN_SIDE);
		if (s.aiOpen) ai = shrink(ai, MIN_AI);
	}
	const out: Partial<LayoutState> = {};
	if (sideDocked && side !== s.sideWidth) out.sideWidth = side;
	if (s.aiOpen && ai !== s.aiWidth) out.aiWidth = ai;
	return out;
}

/** Validates saved layout (it's opaque JSON from disk) field by field. */
export function sanitizeLayout(saved: Record<string, unknown>): Partial<LayoutState> {
	const out: Partial<LayoutState> = {};
	const num = (k: keyof LayoutState, lo: number, hi: number): void => {
		const v = saved[k];
		if (typeof v === 'number' && Number.isFinite(v))
			(out as Record<string, number>)[k] = clamp(v, lo, hi);
	};
	const bool = (k: keyof LayoutState): void => {
		if (typeof saved[k] === 'boolean') (out as Record<string, boolean>)[k] = saved[k];
	};
	if (
		typeof saved['sideView'] === 'string' &&
		(SIDE_VIEWS as readonly string[]).includes(saved['sideView'])
	)
		out.sideView = saved['sideView'] as SideView;
	if (
		typeof saved['panelTab'] === 'string' &&
		(PANEL_TABS as readonly string[]).includes(saved['panelTab'])
	)
		out.panelTab = saved['panelTab'] as PanelTab;
	num('sideWidth', 180, 640);
	num('panelHeight', 120, 900);
	num('aiWidth', 280, 900);
	num('splitRatio', 0.2, 0.8);
	bool('sideOpen');
	bool('panelOpen');
	bool('aiOpen');
	// Zen and maximized are momentary modes; never restore them.
	return out;
}

export const useLayoutStore = create<LayoutState & LayoutActions>((rawSet, get) => {
	// Every change that can show a pane or grow one re-fits the panes to the window.
	const set = (fn: (s: LayoutState) => Partial<LayoutState>, first: 'side' | 'ai' = 'ai'): void =>
		rawSet((s) => {
			const patch = fn(s);
			return { ...patch, ...fitPanes({ ...s, ...patch }, currentViewport(), first) };
		});
	return {
		...LAYOUT_DEFAULTS,
		toggleView: (view) =>
			set((s) =>
				s.sideOpen && s.sideView === view
					? { sideOpen: false }
					: { sideView: view, sideOpen: true, zen: false },
			),
		showView: (view) => set(() => ({ sideView: view, sideOpen: true, zen: false })),
		// Zen hides every pane, so a toggle there reveals the pane (and leaves zen) instead of
		// flipping state nobody can see.
		toggleSide: () =>
			set((s) => (s.zen ? { sideOpen: true, zen: false } : { sideOpen: !s.sideOpen })),
		togglePanel: (tab) =>
			set((s) => {
				if (s.zen)
					return { panelOpen: true, zen: false, ...(tab ? { panelTab: tab } : {}) };
				return tab && s.panelOpen && s.panelTab !== tab
					? { panelTab: tab }
					: { panelOpen: !s.panelOpen, ...(tab ? { panelTab: tab } : {}) };
			}),
		showPanel: (tab) => set(() => ({ panelOpen: true, panelTab: tab, zen: false })),
		toggleMaximizePanel: () =>
			set((s) => ({ panelMaximized: !s.panelMaximized, panelOpen: true, zen: false })),
		toggleAi: (open) =>
			set((s) => {
				const next = open ?? (s.zen ? true : !s.aiOpen);
				return next ? { aiOpen: true, zen: false } : { aiOpen: false };
			}),
		toggleZen: () => set((s) => ({ zen: !s.zen })),
		resize: (patch) =>
			set(
				() => {
					const next: Partial<LayoutState> = {};
					for (const key of Object.keys(PANE_LIMITS) as (keyof typeof PANE_LIMITS)[]) {
						const value = patch[key];
						const { min, max } = PANE_LIMITS[key];
						if (value !== undefined) next[key] = clamp(value, min, max);
					}
					return next;
				},
				patch.sideWidth !== undefined ? 'side' : 'ai',
			),
		hydrate: (saved) =>
			set((s) => {
				// Restoring an open side bar under a drawer skin would cover the editor at every
				// launch: the drawer's close-on-mount runs before the saved layout arrives.
				if (!s.sideDrawer) return saved;
				const rest = { ...saved };
				delete rest.sideOpen;
				return rest;
			}),
		fitToViewport: () => {
			// Only write when something changes: window resizes fire continuously.
			const fit = fitPanes(get(), currentViewport());
			if (Object.keys(fit).length > 0) rawSet(fit);
		},
		setSideDrawer: (drawer) =>
			set((s) => {
				if (s.sideDrawer === drawer) return {};
				return drawer ? { sideDrawer: true, sideOpen: false } : { sideDrawer: false };
			}),
	};
});
