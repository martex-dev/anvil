import type { JSX } from 'react';

import { focusTerminal, useTerminalStore } from '../../features/terminal/terminal-store';
import { useLayoutStore } from '../../stores/layout-store';
import { useTabsStore } from '../../stores/tabs-store';
import { DOCUMENT, PROMPT } from './art-tools';
import { TaskButton } from './TaskButton';

/**
 * A taskbar button for every open editor tab (per group, so a split shows both) and every
 * terminal session. Clicking one brings it to the front.
 */
export function TaskList(): JSX.Element {
	const tabs = useTabsStore((s) => s.tabs);
	const groups = useTabsStore((s) => s.groups);
	const focused = useTabsStore((s) => s.focused);
	const terms = useTerminalStore((s) => s.tabs);
	const activeTerm = useTerminalStore((s) => s.active);
	const terminalShown = useLayoutStore((s) => s.panelOpen && s.panelTab === 'terminal');
	const split = groups.length > 1;
	return (
		<div role='toolbar' aria-label='Open windows' className='wb-tasks'>
			{groups.flatMap((group) =>
				group.tabIds.map((id) => {
					const tab = tabs[id];
					if (!tab) return null;
					const name = tab.kind === 'welcome' ? 'Welcome' : tab.title;
					return (
						<TaskButton
							key={`${group.id}:${id}`}
							art={DOCUMENT}
							label={split ? `${group.id + 1}: ${name}` : name}
							title={tab.path ?? name}
							pressed={group.active === id && focused === group.id}
							onClick={() => useTabsStore.getState().activate(group.id, id)}
						/>
					);
				}),
			)}
			{terms.map((t) => (
				<TaskButton
					key={t.id}
					art={PROMPT}
					label={t.title}
					title={`Terminal: ${t.title}`}
					pressed={terminalShown && activeTerm === t.id}
					// Shows the panel, activates the session and moves keyboard focus into it.
					onClick={() => focusTerminal(t.id)}
				/>
			))}
		</div>
	);
}
