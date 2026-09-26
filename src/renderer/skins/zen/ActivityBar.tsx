import type { JSX } from 'react';

import { VIEW_META, VIEW_SHORT } from '../../app/ActivityBar';
import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { SIDE_VIEWS, useLayoutStore } from '../../stores/layout-store';
import { ContentsEntry } from './ContentsEntry';
import { Fleuron } from './Fleuron';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'] as const;

/**
 * The views as a book's table of contents: roman numerals, serif words, dotted leaders and the
 * shortcut where the page number would be. It lives in the left margin and slides out when
 * the pointer (or Tab) reaches the edge of the page.
 */
export function ActivityBar(): JSX.Element {
	const { status } = useGitStatus();
	const changes = status?.isRepo ? status.staged.length + status.unstaged.length : 0;
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	const current = useLayoutStore((s) => (s.sideOpen ? s.sideView : null));
	return (
		<nav
			aria-label='Views'
			data-part='activity'
			data-orientation='vertical'
			data-placement='rail'
			className='flex h-full w-60 flex-col px-5 pt-6 pb-5'
		>
			<p data-zen='contents-title' aria-hidden>
				Contents
			</p>
			<div className='flex flex-col'>
				{SIDE_VIEWS.map((view, i) => (
					<ContentsEntry
						key={view}
						view={view}
						label={VIEW_META[view].label}
						short={VIEW_SHORT[view]}
						numeral={ROMAN[i] ?? String(i + 1)}
						index={i + 1}
						shortcut={shortcutFor(VIEW_META[view].command)}
						active={current === view}
						onClick={() => useLayoutStore.getState().toggleView(view)}
						{...(view === 'git' ? { badge: changes } : {})}
					/>
				))}
			</div>
			<span data-part='activity-spacer' className='flex-1' />
			<span data-zen='rule' aria-hidden>
				<Fleuron />
			</span>
			<ContentsEntry
				view='ai'
				label='AI assistant'
				short='Assistant'
				numeral='*'
				shortcut={shortcutFor('view.toggleAi')}
				active={aiOpen}
				onClick={() => useLayoutStore.getState().toggleAi()}
			/>
			<ContentsEntry
				view='settings'
				label='Settings'
				short='Settings'
				numeral='§'
				shortcut={shortcutFor('anvil.settings')}
				active={false}
				onClick={() => runCommandById('anvil.settings')}
			/>
		</nav>
	);
}
