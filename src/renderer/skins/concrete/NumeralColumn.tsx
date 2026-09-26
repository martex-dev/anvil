import type { JSX } from 'react';

import { VIEW_META, VIEW_SHORT } from '../../app/ActivityBar';
import { runCommandById } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { SIDE_VIEWS, useLayoutStore } from '../../stores/layout-store';
import { SkinIcon } from '../SkinIcon';
import { NumeralCell } from './NumeralCell';

/**
 * The views switcher as the poster's right margin: a tall ink column of huge numerals 01-09,
 * each captioned in small caps, with AI and settings pinned to the foot.
 */
export function NumeralColumn(): JSX.Element {
	const { status } = useGitStatus();
	const changes = status?.isRepo ? status.staged.length + status.unstaged.length : 0;
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	const current = useLayoutStore((s) => (s.sideOpen ? s.sideView : null));
	return (
		<nav
			aria-label='Views'
			data-part='activity'
			data-orientation='vertical'
			data-placement='right'
			className='cc-band cc-column'
		>
			<div className='cc-column-list'>
				{SIDE_VIEWS.map((view, i) => (
					<NumeralCell
						key={view}
						label={VIEW_META[view].label}
						short={VIEW_SHORT[view]}
						command={VIEW_META[view].command}
						view={view}
						index={i + 1}
						active={current === view}
						onClick={() => useLayoutStore.getState().toggleView(view)}
						{...(view === 'git' ? { badge: changes } : {})}
					/>
				))}
			</div>
			<span data-part='activity-spacer' className='cc-column-spacer' />
			<NumeralCell
				label='AI assistant'
				short='Chat'
				command='view.toggleAi'
				view='ai'
				mark='AI'
				active={aiOpen}
				onClick={() => useLayoutStore.getState().toggleAi()}
			/>
			<NumeralCell
				label='Settings'
				short='Setup'
				command='anvil.settings'
				view='settings'
				mark={<SkinIcon name='settings' size={26} />}
				active={false}
				onClick={() => runCommandById('anvil.settings')}
			/>
		</nav>
	);
}
