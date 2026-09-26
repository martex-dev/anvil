import { create } from 'zustand';

/**
 * What an editor tab shows. Code tabs point at a text buffer (editor-store / file-ops); the
 * other kinds are viewers that read the file themselves.
 */
export type TabKind = 'code' | 'data' | 'image' | 'notebook' | 'markdown' | 'diff' | 'welcome';

export interface DiffPayload {
	/** Title shown on the tab, e.g. "bot.py (HEAD ↔ working tree)". */
	title: string;
	original: string;
	modified: string;
	language: string | null;
	/** File the modified side belongs to, for "open file". */
	path: string | null;
}

export interface Tab {
	id: string;
	kind: TabKind;
	/** Workspace-relative file, null for virtual tabs (welcome, diffs). */
	path: string | null;
	title: string;
	diff?: DiffPayload;
	/** Preview tabs (single click in the explorer) are replaced by the next preview. */
	preview?: boolean;
}

export interface Group {
	id: number;
	tabIds: string[];
	active: string | null;
}

interface TabsState {
	tabs: Record<string, Tab>;
	/** One group, or two side by side after a split. */
	groups: Group[];
	focused: number;
	open: (tab: Tab, options?: { group?: number; background?: boolean }) => void;
	activate: (group: number, id: string) => void;
	focus: (group: number) => void;
	/** Removes a tab from one group. Returns true if no group shows it any more. */
	close: (group: number, id: string) => boolean;
	closeOthers: (group: number, keep: string) => string[];
	/** Opens the tab in the other group (creating it), like "Split Editor Right". */
	split: (id: string) => void;
	/**
	 * Opens a tab in a new second group without touching the focused one ("Open to the Side").
	 * With two groups already, it opens in the other one.
	 */
	openInNewGroup: (tab: Tab) => void;
	closeGroup: (group: number) => void;
	move: (group: number, from: number, to: number) => void;
	pin: (id: string) => void;
	rename: (id: string, patch: Partial<Pick<Tab, 'path' | 'title'>>) => void;
	/** Swaps a tab for another (a new id, e.g. after its file was renamed), in place. */
	replace: (id: string, tab: Tab) => void;
	reset: () => void;
}

export const codeTabId = (path: string): string => `code:${path}`;

function withoutTab(group: Group, id: string): Group {
	const index = group.tabIds.indexOf(id);
	if (index === -1) return group;
	const tabIds = group.tabIds.filter((t) => t !== id);
	const active =
		group.active === id ? (tabIds[index] ?? tabIds[index - 1] ?? null) : group.active;
	return { ...group, tabIds, active };
}

export const useTabsStore = create<TabsState>((set, get) => ({
	tabs: {},
	groups: [{ id: 0, tabIds: [], active: null }],
	focused: 0,
	open: (tab, options = {}) =>
		set((s) => {
			const groupId = options.group ?? s.focused;
			const target = s.groups.find((g) => g.id === groupId);
			// A preview replaces the group's current preview instead of piling up tabs.
			const replaced =
				tab.preview && target && !target.tabIds.includes(tab.id)
					? target.tabIds.find((id) => s.tabs[id]?.preview && id !== tab.id)
					: undefined;
			const groups = s.groups.map((g) => {
				if (g.id !== groupId) return g;
				if (g.tabIds.includes(tab.id))
					return options.background ? g : { ...g, active: tab.id };
				let tabIds = g.tabIds;
				if (replaced) tabIds = tabIds.map((id) => (id === replaced ? tab.id : id));
				else {
					const at = g.active ? g.tabIds.indexOf(g.active) + 1 : g.tabIds.length;
					tabIds = [...tabIds.slice(0, at), tab.id, ...tabIds.slice(at)];
				}
				return { ...g, tabIds, active: options.background && g.active ? g.active : tab.id };
			});
			const existing = s.tabs[tab.id];
			// Re-opening something as a preview must not demote a tab you already kept.
			const merged = existing && !existing.preview ? { ...tab, preview: false } : tab;
			// The replaced preview's record goes too, unless the other group still shows it.
			const drop =
				replaced && !groups.some((g) => g.tabIds.includes(replaced)) ? replaced : null;
			const kept = Object.fromEntries(Object.entries(s.tabs).filter(([key]) => key !== drop));
			const tabs = { ...kept, [tab.id]: merged };
			return { tabs, groups, focused: groupId };
		}),
	activate: (group, id) =>
		set((s) => ({
			groups: s.groups.map((g) => (g.id === group ? { ...g, active: id } : g)),
			focused: group,
		})),
	focus: (group) => set({ focused: group }),
	close: (group, id) => {
		const s = get();
		let groups = s.groups.map((g) => (g.id === group ? withoutTab(g, id) : g));
		// Empty groups fold away (left or right); one group always stays, even when empty.
		if (groups.length > 1) {
			const nonEmpty = groups.filter((g) => g.tabIds.length > 0);
			groups = nonEmpty.length > 0 ? nonEmpty : groups.slice(0, 1);
		}
		const stillShown = groups.some((g) => g.tabIds.includes(id));
		const tabs = stillShown
			? s.tabs
			: Object.fromEntries(Object.entries(s.tabs).filter(([key]) => key !== id));
		const focused = groups.some((g) => g.id === s.focused) ? s.focused : (groups[0]?.id ?? 0);
		set({ groups, tabs, focused });
		return !stillShown;
	},
	closeOthers: (group, keep) => {
		const g = get().groups.find((x) => x.id === group);
		const others = g ? g.tabIds.filter((id) => id !== keep) : [];
		return others;
	},
	split: (id) =>
		set((s) => {
			if (s.groups.length === 1) {
				const next: Group = {
					id: Math.max(...s.groups.map((g) => g.id)) + 1,
					tabIds: [id],
					active: id,
				};
				return { groups: [...s.groups, next], focused: next.id };
			}
			const target = s.groups.find((g) => g.id !== s.focused) ?? s.groups[1];
			if (!target) return s;
			return {
				groups: s.groups.map((g) =>
					g.id === target.id
						? {
								...g,
								tabIds: g.tabIds.includes(id) ? g.tabIds : [...g.tabIds, id],
								active: id,
							}
						: g,
				),
				focused: target.id,
			};
		}),
	openInNewGroup: (tab) => {
		const s = get();
		const other = s.groups.find((g) => g.id !== s.focused);
		if (other) {
			s.open(tab, { group: other.id });
			return;
		}
		const next: Group = {
			id: Math.max(...s.groups.map((g) => g.id)) + 1,
			tabIds: [tab.id],
			active: tab.id,
		};
		set({
			tabs: { ...s.tabs, [tab.id]: s.tabs[tab.id] ?? tab },
			groups: [...s.groups, next],
			focused: next.id,
		});
	},
	closeGroup: (group) =>
		set((s) => {
			if (s.groups.length === 1) return s;
			const closing = s.groups.find((g) => g.id === group);
			const rest = s.groups.filter((g) => g.id !== group);
			const keep = rest[0];
			if (!keep) return s;
			// Tabs only shown in the closed group move over instead of disappearing.
			const moved = (closing?.tabIds ?? []).filter((id) => !keep.tabIds.includes(id));
			return {
				groups: [
					{
						...keep,
						tabIds: [...keep.tabIds, ...moved],
						active: keep.active ?? moved[0] ?? null,
					},
				],
				focused: keep.id,
			};
		}),
	move: (group, from, to) =>
		set((s) => ({
			groups: s.groups.map((g) => {
				if (g.id !== group) return g;
				const tabIds = [...g.tabIds];
				const [item] = tabIds.splice(from, 1);
				if (item !== undefined) tabIds.splice(to, 0, item);
				return { ...g, tabIds };
			}),
		})),
	pin: (id) =>
		set((s) => {
			const tab = s.tabs[id];
			return tab?.preview ? { tabs: { ...s.tabs, [id]: { ...tab, preview: false } } } : s;
		}),
	rename: (id, patch) =>
		set((s) => {
			const tab = s.tabs[id];
			return tab ? { tabs: { ...s.tabs, [id]: { ...tab, ...patch } } } : s;
		}),
	replace: (id, tab) =>
		set((s) => {
			if (!s.tabs[id]) return s;
			const tabs = Object.fromEntries(Object.entries(s.tabs).filter(([key]) => key !== id));
			tabs[tab.id] = tab;
			const swap = (t: string): string => (t === id ? tab.id : t);
			return {
				tabs,
				groups: s.groups.map((g) => ({
					...g,
					tabIds: [...new Set(g.tabIds.map(swap))],
					active: g.active === null ? null : swap(g.active),
				})),
			};
		}),
	reset: () => set({ tabs: {}, groups: [{ id: 0, tabIds: [], active: null }], focused: 0 }),
}));

/** The tab in front of the focused group. */
export function focusedTab(s: Pick<TabsState, 'tabs' | 'groups' | 'focused'>): Tab | null {
	const group = s.groups.find((g) => g.id === s.focused) ?? s.groups[0];
	return group?.active ? (s.tabs[group.active] ?? null) : null;
}

/** Every group showing a tab. */
export function groupsShowing(id: string): number[] {
	return useTabsStore
		.getState()
		.groups.filter((g) => g.tabIds.includes(id))
		.map((g) => g.id);
}
