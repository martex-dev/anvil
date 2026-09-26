import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { TITLE_BAR_HEIGHT } from '../../app/TitleBar';
import { useLayoutStore } from '../../stores/layout-store';
import { IconButton } from '../../ui/IconButton';
import { SkinIcon } from '../SkinIcon';
import { DocumentTitle } from './DocumentTitle';
import { TextMenu } from './TextMenu';
import { WindowButtons } from './WindowButtons';

const MENUS: Array<{ label: string; categories: CommandCategory[] }> = [
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
 * A nearly invisible running head: the document's name in italic, centered over a hairline
 * rule. The menu words, the view toggles and the window rings stay faint until the pointer
 * or keyboard focus comes to the top of the page.
 */
export function TitleBar(): JSX.Element {
	const layout = useLayoutStore();
	return (
		<header
			data-part='titlebar'
			className='drag relative z-20 flex shrink-0 items-center gap-1 pl-4'
			style={{ height: TITLE_BAR_HEIGHT }}
		>
			<span data-part='brand' className='pr-2'>
				Anvil
			</span>
			<nav data-part='menubar' className='flex items-center' aria-label='Menu'>
				{MENUS.map((m) => (
					<TextMenu key={m.label} {...m} />
				))}
			</nav>

			<DocumentTitle />

			<div data-part='title-actions' className='no-drag ml-auto flex items-center gap-0.5'>
				<IconButton
					size='sm'
					label='Run Python file'
					shortcut={shortcutFor('python.runFile')}
					icon={<SkinIcon name='play' size={14} />}
					onClick={() => runCommandById('python.runFile')}
				/>
				<span data-zen='dot' aria-hidden>
					·
				</span>
				<IconButton
					size='sm'
					label='Contents (side bar)'
					shortcut={shortcutFor('view.toggleSide')}
					active={layout.sideOpen}
					icon={<SkinIcon name='sidebar' size={15} />}
					onClick={layout.toggleSide}
				/>
				<IconButton
					size='sm'
					label='Toggle panel'
					shortcut={shortcutFor('view.togglePanel')}
					active={layout.panelOpen}
					icon={<SkinIcon name='panel' size={15} />}
					onClick={() => layout.togglePanel()}
				/>
				<IconButton
					size='sm'
					label='Toggle assistant'
					shortcut={shortcutFor('view.toggleAi')}
					active={layout.aiOpen}
					icon={<SkinIcon name='ai' size={15} />}
					onClick={() => layout.toggleAi()}
				/>
				<IconButton
					size='sm'
					label='Settings'
					shortcut={shortcutFor('anvil.settings')}
					icon={<SkinIcon name='settings' size={15} />}
					onClick={() => runCommandById('anvil.settings')}
				/>
			</div>
			<WindowButtons />
		</header>
	);
}
