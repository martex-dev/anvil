import type { Tab } from '../../stores/tabs-store';
import { useTabsStore } from '../../stores/tabs-store';
import type { MenuItem } from '../../ui/ContextMenu';
import { isScratch } from './file-ops';
import { closeOtherTabs, closeTab } from './open';
import { copyPath, revealInExplorer } from './tab-actions';

/** The right-click menu of a tab in `group`. File actions only for tabs backed by a real file. */
export function tabMenuItems(tab: Tab, group: number): Array<MenuItem | 'separator'> {
	const path = tab.path && !isScratch(tab.path) ? tab.path : null;
	const items: Array<MenuItem | 'separator'> = [
		{ label: 'Close', shortcut: 'Ctrl+W', onSelect: () => closeTab(group, tab.id) },
		{ label: 'Close Others', onSelect: () => closeOtherTabs(group, tab.id) },
		'separator',
		{
			label: 'Split Right',
			shortcut: 'Ctrl+\\',
			onSelect: () => useTabsStore.getState().split(tab.id),
		},
		...(tab.preview
			? [{ label: 'Keep Open', onSelect: () => useTabsStore.getState().pin(tab.id) }]
			: []),
	];
	if (!path) return items;
	return [
		...items,
		'separator',
		{ label: 'Copy Path', onSelect: () => void copyPath(path, true) },
		{ label: 'Copy Relative Path', onSelect: () => void copyPath(path, false) },
		{ label: 'Reveal in Explorer View', onSelect: () => revealInExplorer(path) },
	];
}
