import {
	Command as CommandIcon,
	Expand,
	FileSearch,
	FolderOpen,
	FolderPlus,
	FolderX,
	Keyboard,
	LayoutPanelTop,
	Maximize,
	RefreshCw,
	Settings,
	Sparkle,
	SquareTerminal,
} from 'lucide-react';

import { VIEW_META } from '../../app/ActivityBar';
import { closeFolder, openFolderDialog } from '../../features/explorer/workspace-actions';
import { call } from '../../lib/ipc';
import { SIDE_VIEWS, type SideView, useLayoutStore } from '../../stores/layout-store';
import { useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { useUiStore } from '../../stores/ui-store';
import { useViewFocus } from '../../stores/view-focus-store';
import { getSettings, updateSettings } from '../hooks/use-settings';
import type { Command } from './types';

const VIEW_KEYS: Partial<Record<SideView, string>> = {
	explorer: 'Ctrl+Shift+E',
	search: 'Ctrl+Shift+F',
	git: 'Ctrl+Shift+G',
	run: 'Ctrl+Shift+D',
	snippets: 'Ctrl+Shift+J',
	toolbox: 'Ctrl+Shift+X',
};

const viewCommands: Command[] = SIDE_VIEWS.map((view) => ({
	id: VIEW_META[view].command,
	title: `Show ${VIEW_META[view].label}`,
	category: 'View' as const,
	...(VIEW_KEYS[view] ? { shortcut: VIEW_KEYS[view] } : {}),
	icon: VIEW_META[view].icon,
	run: () => {
		useLayoutStore.getState().showView(view);
		useViewFocus.getState().request(view);
	},
}));

export const CORE_COMMANDS: Command[] = [
	{
		id: 'view.palette',
		title: 'Command Palette',
		category: 'View',
		shortcut: 'Ctrl+Shift+P',
		icon: CommandIcon,
		run: () => useUiStore.getState().setPaletteOpen(true),
	},
	{
		id: 'view.paletteF1',
		title: 'Command Palette (F1)',
		category: 'View',
		shortcut: 'F1',
		run: () => useUiStore.getState().setPaletteOpen(true),
	},
	{
		id: 'file.quickOpen',
		title: 'Quick Open File…',
		category: 'Go',
		shortcut: 'Ctrl+P',
		icon: FileSearch,
		run: () => useUiStore.getState().openQuickOpen(''),
	},
	{
		id: 'go.symbol',
		title: 'Go to Symbol in File…',
		category: 'Go',
		shortcut: 'Ctrl+Shift+O',
		run: () => useUiStore.getState().openQuickOpen('@'),
	},
	{
		id: 'go.line',
		title: 'Go to Line…',
		category: 'Go',
		shortcut: 'Ctrl+G',
		run: () => useUiStore.getState().openQuickOpen(':'),
	},
	{
		id: 'file.openFolder',
		title: 'Open Folder…',
		category: 'File',
		shortcut: 'Ctrl+O',
		keywords: ['project', 'workspace'],
		icon: FolderOpen,
		run: openFolderDialog,
	},
	{
		id: 'file.closeFolder',
		title: 'Close Folder',
		category: 'File',
		icon: FolderX,
		run: closeFolder,
	},
	{
		id: 'file.newProject',
		title: 'New Project from Template…',
		category: 'File',
		shortcut: 'Ctrl+Alt+N',
		keywords: ['quant', 'trading bot', 'ml', 'fastapi', 'uv'],
		icon: FolderPlus,
		run: () => useUiStore.getState().setTemplatesOpen(true),
	},
	...viewCommands,
	{
		id: 'view.toggleSide',
		title: 'Toggle Side Bar',
		category: 'View',
		shortcut: 'Ctrl+B',
		run: () => useLayoutStore.getState().toggleSide(),
	},
	{
		id: 'view.togglePanel',
		title: 'Toggle Panel',
		category: 'View',
		shortcut: 'Ctrl+J',
		icon: LayoutPanelTop,
		run: () => useLayoutStore.getState().togglePanel(),
	},
	{
		id: 'view.toggleTerminal',
		title: 'Toggle Terminal',
		category: 'View',
		shortcut: 'Ctrl+`',
		icon: SquareTerminal,
		run: () => useLayoutStore.getState().togglePanel('terminal'),
	},
	{
		id: 'view.problems',
		title: 'Show Problems',
		category: 'View',
		shortcut: 'Ctrl+Shift+M',
		run: () => useLayoutStore.getState().showPanel('problems'),
	},
	{
		id: 'view.maximizePanel',
		title: 'Maximize / Restore Panel',
		category: 'View',
		icon: Expand,
		run: () => useLayoutStore.getState().toggleMaximizePanel(),
	},
	{
		id: 'view.toggleAi',
		title: 'Toggle AI Panel',
		category: 'View',
		shortcut: 'Ctrl+Alt+B',
		run: () => useLayoutStore.getState().toggleAi(),
	},
	{
		id: 'view.zen',
		title: 'Toggle Zen Mode',
		category: 'View',
		shortcut: 'Ctrl+Alt+Z',
		keywords: ['focus', 'distraction free'],
		icon: Sparkle,
		run: () => useLayoutStore.getState().toggleZen(),
	},
	{
		id: 'view.fullscreen',
		title: 'Toggle Full Screen',
		category: 'View',
		shortcut: 'F11',
		icon: Maximize,
		run: () => void call('app:toggleFullScreen'),
	},
	{
		id: 'view.focusGroup1',
		title: 'Focus First Editor Group',
		category: 'View',
		shortcut: 'Ctrl+1',
		run: () => {
			const g = useTabsStore.getState().groups[0];
			if (g) useTabsStore.getState().focus(g.id);
		},
	},
	{
		id: 'view.focusGroup2',
		title: 'Focus Second Editor Group',
		category: 'View',
		shortcut: 'Ctrl+2',
		run: () => {
			const g = useTabsStore.getState().groups[1];
			if (g) useTabsStore.getState().focus(g.id);
		},
	},
	{
		id: 'anvil.welcome',
		title: 'Welcome',
		category: 'Anvil',
		run: () =>
			useTabsStore
				.getState()
				.open({ id: 'welcome', kind: 'welcome', path: null, title: 'Welcome' }),
	},
	{
		id: 'anvil.settings',
		title: 'Settings',
		category: 'Anvil',
		shortcut: 'Ctrl+,',
		icon: Settings,
		run: () => useUiStore.getState().openSettings(),
	},
	{
		id: 'anvil.keys',
		title: 'API Keys…',
		category: 'Anvil',
		keywords: ['secrets', 'anthropic', 'openai', 'token'],
		run: () => useUiStore.getState().openSettings('keys'),
	},
	{
		id: 'anvil.shortcuts',
		title: 'Keyboard Shortcuts',
		category: 'Anvil',
		shortcut: 'Ctrl+Alt+/',
		icon: Keyboard,
		run: () => useUiStore.getState().setShortcutsOpen(true),
	},
	{
		id: 'anvil.glass',
		title: 'Cycle Glass Effect (full / subtle / off)',
		category: 'Anvil',
		keywords: ['performance', 'blur', 'transparency'],
		run: async () => {
			const order = ['full', 'subtle', 'off'] as const;
			const next = order[(order.indexOf(getSettings().glass) + 1) % order.length] ?? 'full';
			await updateSettings({ glass: next });
			toast.info(`Glass: ${next}`);
		},
	},
	{
		id: 'anvil.reload',
		title: 'Reload Window',
		category: 'Anvil',
		icon: RefreshCw,
		run: () => void call('app:reloadWindow'),
	},
	{
		id: 'anvil.devtools',
		title: 'Toggle Developer Tools',
		category: 'Anvil',
		run: () => void call('app:toggleDevTools'),
	},
	{
		id: 'anvil.logs',
		title: 'Open Log Folder',
		category: 'Anvil',
		run: () => void call('app:openLogs'),
	},
	{
		id: 'anvil.checkUpdates',
		title: 'Check for Updates',
		category: 'Anvil',
		run: async () => {
			const s = await call('update:check');
			toast.info(
				'Updates',
				s.state === 'disabled'
					? s.reason
					: s.state === 'idle'
						? 'You are up to date'
						: s.state,
			);
		},
	},
];
