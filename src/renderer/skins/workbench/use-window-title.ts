import { useWorkspace } from '../../app/hooks/use-workspace';
import { useTabsStore } from '../../stores/tabs-store';

/** "Anvil - strategy.py": the program, then the document in front (or the open folder). */
export function useWindowTitle(): string {
	const { info } = useWorkspace();
	const document = useTabsStore((s) => {
		const group = s.groups.find((g) => g.id === s.focused) ?? s.groups[0];
		const tab = group?.active ? s.tabs[group.active] : undefined;
		if (!tab) return null;
		return tab.kind === 'welcome' ? 'Welcome' : tab.title;
	});
	const subject = document ?? info.name;
	return subject ? `Anvil - ${subject}` : 'Anvil';
}
