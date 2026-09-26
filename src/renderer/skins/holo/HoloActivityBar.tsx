import type { JSX } from 'react';

import { VIEW_META, VIEW_SHORT } from '../../app/ActivityBar';
import { runCommandById } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { SIDE_VIEWS, useLayoutStore } from '../../stores/layout-store';
import { NavTab } from './NavTab';

/**
 * The views switcher as a navigation rail: a NAV//VIEWS tag, then chevron keys on a thin light
 * line, with the AI core and setup keys docked at the far end.
 */
export function HoloActivityBar(): JSX.Element {
	const { status } = useGitStatus();
	const changes = status?.isRepo ? status.staged.length + status.unstaged.length : 0;
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	const current = useLayoutStore((s) => (s.sideOpen ? s.sideView : null));
	return (
		<nav
			aria-label='Views'
			data-part='activity'
			data-orientation='horizontal'
			data-placement='top'
			className='ho-activity'
		>
			<span className='ho-activity-tag' aria-hidden>
				NAV<b>{'//VIEWS'}</b>
			</span>
			{SIDE_VIEWS.map((view, i) => (
				<NavTab
					key={view}
					label={VIEW_META[view].label}
					short={VIEW_SHORT[view]}
					command={VIEW_META[view].command}
					icon={view}
					index={i + 1}
					code={String(i + 1).padStart(2, '0')}
					active={current === view}
					onClick={() => useLayoutStore.getState().toggleView(view)}
					{...(view === 'git' ? { badge: changes } : {})}
				/>
			))}
			<span data-part='activity-spacer' className='ho-activity-spacer' />
			<NavTab
				label='AI assistant'
				short='AI Core'
				command='view.toggleAi'
				icon='ai'
				code='AI'
				active={aiOpen}
				onClick={() => useLayoutStore.getState().toggleAi()}
			/>
			<NavTab
				label='Settings'
				short='Setup'
				command='anvil.settings'
				icon='settings'
				code='CFG'
				active={false}
				onClick={() => runCommandById('anvil.settings')}
			/>
		</nav>
	);
}
