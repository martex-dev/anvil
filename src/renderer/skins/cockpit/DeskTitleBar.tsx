import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useWindowState } from '../../app/hooks/use-window-state';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { WindowControls } from '../../app/WindowControls';
import { useLayoutStore } from '../../stores/layout-store';
import { DeskKey } from './DeskKey';
import { DeskMenu, type DeskMenuSpec } from './DeskMenu';

const MENUS: DeskMenuSpec[] = [
	{ label: 'File', categories: ['File'] },
	{ label: 'Edit', categories: ['Edit'] },
	{ label: 'View', categories: ['View'] },
	{ label: 'Go', categories: ['Go'] },
	{ label: 'Run', categories: ['Run', 'Python', 'Terminal'] },
	{ label: 'AI', categories: ['AI'] },
	{ label: 'Git', categories: ['Git'] },
	{ label: 'Tools', categories: ['Tools', 'Anvil'] },
];

/**
 * A slim desk header: the ANVIL PROFESSIONAL wordmark, small-caps menus, the open book
 * (workspace) and the pane keys. The empty middle is the window's drag handle.
 */
export function DeskTitleBar(): JSX.Element {
	const { info } = useWorkspace();
	const { focused } = useWindowState();
	const sideOpen = useLayoutStore((s) => s.sideOpen);
	const panelOpen = useLayoutStore((s) => s.panelOpen);
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	return (
		<header data-part='titlebar' className='ck-titlebar drag'>
			<div data-part='brand' className='ck-brand'>
				<span className='ck-brand-mark'>ANVIL</span>
				<span className='ck-brand-sub'>PROFESSIONAL</span>
			</div>
			<nav data-part='menubar' aria-label='Menu' className='ck-menubar'>
				{MENUS.map((m) => (
					<DeskMenu key={m.label} {...m} />
				))}
			</nav>
			<div className='ck-title-book' aria-label='Workspace'>
				<span
					className='ck-lamp'
					data-on={focused}
					title={focused ? 'Window focused' : 'Window in background'}
				>
					{focused ? 'LIVE' : 'IDLE'}
				</span>
				<span className='ck-field-label'>BOOK</span>
				<span className='ck-field-value'>{info.name ?? 'NO FOLDER'}</span>
			</div>
			<div data-part='title-actions' className='ck-title-keys no-drag'>
				<DeskKey
					label='Run Python file'
					cap='RUN'
					icon='play'
					tone='go'
					shortcut={shortcutFor('python.runFile')}
					onClick={() => runCommandById('python.runFile')}
				/>
				<DeskKey
					label='Toggle side bar'
					cap='SIDE'
					icon='sidebar'
					active={sideOpen}
					shortcut={shortcutFor('view.toggleSide')}
					onClick={() => useLayoutStore.getState().toggleSide()}
				/>
				<DeskKey
					label='Toggle panel'
					cap='PNL'
					icon='panel'
					active={panelOpen}
					shortcut={shortcutFor('view.togglePanel')}
					onClick={() => useLayoutStore.getState().togglePanel()}
				/>
				<DeskKey
					label='Toggle AI'
					cap='AI'
					icon='ai'
					active={aiOpen}
					shortcut={shortcutFor('view.toggleAi')}
					onClick={() => useLayoutStore.getState().toggleAi()}
				/>
				<DeskKey
					label='Settings'
					cap='CFG'
					icon='settings'
					shortcut={shortcutFor('anvil.settings')}
					onClick={() => runCommandById('anvil.settings')}
				/>
			</div>
			<WindowControls />
		</header>
	);
}
