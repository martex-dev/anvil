import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { WorkspaceInfo } from '@shared/ipc/channels/workspace';

import { getSettings } from '../../app/hooks/use-settings';
import { useWorkspace, WORKSPACE_KEY } from '../../app/hooks/use-workspace';
import { rememberRecentFile } from '../../app/QuickOpen';
import { rlog } from '../../lib/log';
import { refreshEditorConfiguration } from '../../lib/monaco/load';
import { REDUCED_MOTION_QUERY } from '../../lib/monaco/theme';
import { setMonacoWorkspaceRoot } from '../../lib/monaco/workspace-root';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { focusedTab, type Tab, useTabsStore } from '../../stores/tabs-store';
import { useWorkbenchStore } from '../../stores/workbench-store';
import { clearCompareSelection } from './compare';
import { dirtyCount, useEditorStore } from './editor-store';
import { setBookmarksRoot } from './extras/bookmarks';
import { invalidateGitLines } from './extras/git-lines';
import { onExternalChange } from './file-ops';
import { navHistory } from './nav-history';
import { closeAllTabs, openPath, remembersRecent } from './open';

interface SavedTab {
	kind: Tab['kind'];
	path: string | null;
}
interface Session {
	groups: Array<{ tabs: SavedTab[]; active: number }>;
}

const key = (root: string): string => `anvil.session:${root.toLowerCase()}`;

function saveSession(root: string): void {
	const { groups, tabs } = useTabsStore.getState();
	const session: Session = {
		groups: groups.map((g) => {
			const list = g.tabIds
				.map((id) => tabs[id])
				.filter((t): t is Tab => Boolean(t) && t?.kind !== 'diff' && t?.kind !== 'welcome');
			return {
				tabs: list.map((t) => ({ kind: t.kind, path: t.path })),
				active: Math.max(
					0,
					list.findIndex((t) => t.id === g.active),
				),
			};
		}),
	};
	try {
		localStorage.setItem(key(root), JSON.stringify(session));
	} catch {
		// Non-critical.
	}
}

function loadSession(root: string): Session | null {
	try {
		const raw = JSON.parse(localStorage.getItem(key(root)) ?? 'null') as Session | null;
		return raw && Array.isArray(raw.groups) ? raw : null;
	} catch {
		return null;
	}
}

/**
 * Headless glue between the editor and the rest of the app: open-file requests, the
 * leave-workspace guard, external file changes, per-folder tab sessions and theme refresh.
 */
export function EditorBridge(): null {
	const client = useQueryClient();
	const { info } = useWorkspace();
	const root = info.root;
	// Language features read other files through Monaco's file service, scoped to this folder;
	// bookmarks are kept per folder too.
	useEffect(() => {
		setMonacoWorkspaceRoot(root);
		setBookmarksRoot(root);
	}, [root]);

	useEffect(() => {
		const { setOpenFileHandler } = useWorkbenchStore.getState();
		setOpenFileHandler((request) => {
			const current = client.getQueryData<WorkspaceInfo>(WORKSPACE_KEY)?.root;
			if (!current) return;
			if (remembersRecent(request)) rememberRecentFile(request.path);
			void openPath(current, request);
		});
		const removeGuard = useWorkbenchStore.getState().addLeaveGuard(() => {
			const n = dirtyCount();
			return n > 0 ? `Save or close ${n} unsaved file${n === 1 ? '' : 's'} first.` : null;
		});
		return () => {
			setOpenFileHandler(null);
			removeGuard();
		};
	}, [client]);

	// The "active file" other features follow is the code tab in front of the focused group.
	useEffect(
		() =>
			useTabsStore.subscribe((s) => {
				const tab = focusedTab(s);
				const path = tab?.kind === 'code' ? tab.path : null;
				if (useEditorStore.getState().active !== path)
					useEditorStore.getState().setActive(path);
				if (useWorkbenchStore.getState().activeFile !== path)
					useWorkbenchStore.getState().setActiveFile(path);
				if (!path) useEditorStore.getState().setCursor(null);
			}),
		[],
	);

	useAnvilEvent('fs:changed', ({ files }) => onExternalChange(files));
	useAnvilEvent('git:changed', () => invalidateGitLines());

	// New folder: close the old folder's tabs, forget its places, compare pick and HEAD
	// contents (all keyed by relative path), and restore this folder's session.
	useEffect(() => {
		closeAllTabs();
		navHistory.clear();
		clearCompareSelection();
		invalidateGitLines();
		if (!root) {
			useTabsStore
				.getState()
				.open({ id: 'welcome', kind: 'welcome', path: null, title: 'Welcome' });
			return;
		}
		const session = loadSession(root);
		if (!session || session.groups.every((g) => g.tabs.length === 0)) {
			useTabsStore
				.getState()
				.open({ id: 'welcome', kind: 'welcome', path: null, title: 'Welcome' });
			return;
		}
		// Switching folders again mid-restore stops this loop: its tabs belong to the old root.
		let cancelled = false;
		void (async () => {
			try {
				for (const [gi, g] of session.groups.entries()) {
					for (const t of g.tabs) {
						if (cancelled) return;
						if (!t.path) continue;
						await openPath(root, {
							path: t.path,
							as:
								t.kind === 'code' || t.kind === 'data' || t.kind === 'markdown'
									? t.kind
									: undefined,
							side: gi > 0 && useTabsStore.getState().groups.length === 1,
							// Restoring must not pull focus from wherever you're already typing.
							focus: false,
						});
					}
					if (cancelled) return;
					const group = useTabsStore.getState().groups[gi];
					const active = group?.tabIds[g.active];
					if (group && active) useTabsStore.getState().activate(group.id, active);
				}
				const first = useTabsStore.getState().groups[0];
				if (first) useTabsStore.getState().focus(first.id);
			} catch (error) {
				rlog.warn('editor', 'session restore failed', error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [root]);

	useEffect(() => {
		if (!root) return;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const off = useTabsStore.subscribe(() => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => saveSession(root), 300);
		});
		return () => {
			if (timer) clearTimeout(timer);
			off();
		};
	}, [root]);

	// Theme, accent and editor settings feed the Monaco theme. applyAppearance fires
	// 'anvil:appearance' once the new tokens are live (also for theme previews).
	useEffect(() => {
		// Coalesced: each refresh makes Monaco re-tokenize every open file, and arrowing through
		// the theme picker fires one per keypress.
		let timer: ReturnType<typeof setTimeout> | undefined;
		const refresh = (): void => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				void refreshEditorConfiguration(getSettings()).catch((error: unknown) =>
					rlog.warn('editor', 'theme refresh failed', error),
				);
			}, 60);
		};
		window.addEventListener('anvil:appearance', refresh);
		// The OS reduced-motion switch also changes the editor's scroll and cursor animations.
		const motion = window.matchMedia(REDUCED_MOTION_QUERY);
		motion.addEventListener('change', refresh);
		return () => {
			clearTimeout(timer);
			window.removeEventListener('anvil:appearance', refresh);
			motion.removeEventListener('change', refresh);
		};
	}, []);

	return null;
}
