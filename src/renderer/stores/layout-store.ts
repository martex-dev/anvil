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

export const useLayoutStore = create<LayoutState & LayoutActions>((set) => ({
	...LAYOUT_DEFAULTS,
	toggleView: (view) =>
		set((s) =>
			s.sideOpen && s.sideView === view
				? { sideOpen: false }
				: { sideView: view, sideOpen: true, zen: false },
		),
	showView: (view) => set({ sideView: view, sideOpen: true, zen: false }),
	toggleSide: () => set((s) => ({ sideOpen: !s.sideOpen })),
	togglePanel: (tab) =>
		set((s) =>
			tab && s.panelOpen && s.panelTab !== tab
				? { panelTab: tab }
				: { panelOpen: !s.panelOpen, ...(tab ? { panelTab: tab } : {}) },
		),
	showPanel: (tab) => set({ panelOpen: true, panelTab: tab }),
	toggleMaximizePanel: () => set((s) => ({ panelMaximized: !s.panelMaximized, panelOpen: true })),
	toggleAi: (open) => set((s) => ({ aiOpen: open ?? !s.aiOpen })),
	toggleZen: () => set((s) => ({ zen: !s.zen })),
	resize: (patch) =>
		set(() => {
			const next: Partial<LayoutState> = {};
			if (patch.sideWidth !== undefined) next.sideWidth = clamp(patch.sideWidth, 180, 640);
			if (patch.panelHeight !== undefined)
				next.panelHeight = clamp(patch.panelHeight, 120, 900);
			if (patch.aiWidth !== undefined) next.aiWidth = clamp(patch.aiWidth, 280, 900);
			if (patch.splitRatio !== undefined) next.splitRatio = clamp(patch.splitRatio, 0.2, 0.8);
			return next;
		}),
	hydrate: (saved) => set(saved),
}));
