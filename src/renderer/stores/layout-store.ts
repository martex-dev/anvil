import { create } from 'zustand';

export const SIDE_VIEWS = [
	'explorer',
	'search',
	'git',
	'run',
	'outline',
	'todos',
	'history',
	'snippets',
	'toolbox',
] as const;
export type SideView = (typeof SIDE_VIEWS)[number];

export type PanelTab = 'terminal' | 'problems';

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
}

interface LayoutActions {
	/** Opens a side view; the same view again collapses the side bar (activity bar behaviour). */
	toggleView: (view: SideView) => void;
	showView: (view: SideView) => void;
	toggleSide: () => void;
	togglePanel: (tab?: PanelTab) => void;
	showPanel: (tab: PanelTab) => void;
	toggleMaximizePanel: () => void;
	toggleAi: (open?: boolean) => void;
	toggleZen: () => void;
	resize: (
		patch: Partial<Pick<LayoutState, 'sideWidth' | 'panelHeight' | 'aiWidth' | 'splitRatio'>>,
	) => void;
	hydrate: (saved: Partial<LayoutState>) => void;
	/** Re-fits the side and AI panes after the window was resized. */
	fitToViewport: () => void;
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

const viewportWidth = (): number =>
	typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;

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
	let side = s.sideOpen ? s.sideWidth : 0;
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
		if (s.sideOpen) side = shrink(side, MIN_SIDE);
	} else {
		if (s.sideOpen) side = shrink(side, MIN_SIDE);
		if (s.aiOpen) ai = shrink(ai, MIN_AI);
	}
	const out: Partial<LayoutState> = {};
	if (s.sideOpen && side !== s.sideWidth) out.sideWidth = side;
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
	if (saved['panelTab'] === 'terminal' || saved['panelTab'] === 'problems')
		out.panelTab = saved['panelTab'];
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
			return { ...patch, ...fitWidths({ ...s, ...patch }, viewportWidth(), first) };
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
		hydrate: (saved) => set(() => saved),
		fitToViewport: () => {
			// Only write when something changes: window resizes fire continuously.
			const fit = fitWidths(get(), viewportWidth());
			if (Object.keys(fit).length > 0) rawSet(fit);
		},
	};
});
