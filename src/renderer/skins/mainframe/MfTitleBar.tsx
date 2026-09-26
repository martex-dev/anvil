import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { PythonEnvChip } from '../../features/python/PythonEnvChip';
import { useLayoutStore } from '../../stores/layout-store';
import { useUiStore } from '../../stores/ui-store';
import { MfMenu } from './MfMenu';
import { MfWindowControls } from './MfWindowControls';
import { TextToggle } from './TextToggle';

const MENUS: ReadonlyArray<{ label: string; categories: readonly CommandCategory[] }> = [
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
 * The title bar as one line of a man page header: `ANVIL(1)`, the text menu bar, the open
 * workspace ruled off in box-drawing dashes, a vim-style `:` prompt that opens Quick Open,
 * text switches and bracketed window buttons. The line itself drags the window.
 */
export function MfTitleBar(): JSX.Element {
	const { info } = useWorkspace();
	const openQuick = useUiStore((s) => s.openQuickOpen);
	const layout = useLayoutStore();
	return (
		<header data-part='titlebar' className='mf-titlebar drag'>
			<span data-part='brand' className='mf-brand'>
				ANVIL(1)
			</span>
			<nav data-part='menubar' aria-label='Menu' className='mf-menubar'>
				{MENUS.map((m) => (
					<MfMenu key={m.label} {...m} />
				))}
			</nav>
			<span aria-hidden className='mf-title-rule' />
			<span className='mf-title-path' title={info.root ?? undefined}>
				{info.name ? `~/${info.name}` : 'no workspace'}
			</span>
			<span aria-hidden className='mf-title-rule' />
			<button
				type='button'
				data-part='command-center'
				onClick={() => openQuick('')}
				className='mf-prompt no-drag'
			>
				<span className='mf-prompt-colon'>:</span>
				<span className='mf-prompt-text'>find files, commands, symbols</span>
				<span className='mf-cursor' aria-hidden />
				<span className='mf-prompt-key'>{shortcutFor('file.quickOpen') ?? 'Ctrl+P'}</span>
			</button>
			<div data-part='title-actions' className='mf-title-actions no-drag'>
				<PythonEnvChip compact />
				<TextToggle
					text='RUN'
					label='Run Python file'
					shortcut={shortcutFor('python.runFile')}
					onClick={() => runCommandById('python.runFile')}
				/>
				<TextToggle
					text='SB'
					label='Toggle side bar'
					shortcut={shortcutFor('view.toggleSide')}
					active={layout.sideOpen}
					onClick={layout.toggleSide}
				/>
				<TextToggle
					text='PN'
					label='Toggle panel'
					shortcut={shortcutFor('view.togglePanel')}
					active={layout.panelOpen}
					onClick={() => layout.togglePanel()}
				/>
				<TextToggle
					text='AI'
					label='Toggle AI'
					shortcut={shortcutFor('view.toggleAi')}
					active={layout.aiOpen}
					onClick={() => layout.toggleAi()}
				/>
				<TextToggle
					text='CFG'
					label='Settings'
					shortcut={shortcutFor('anvil.settings')}
					onClick={() => runCommandById('anvil.settings')}
				/>
			</div>
			<MfWindowControls />
		</header>
	);
}
