import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { PythonEnvChip } from '../../features/python/PythonEnvChip';
import { useLayoutStore } from '../../stores/layout-store';
import { useUiStore } from '../../stores/ui-store';
import { IconButton } from '../../ui/IconButton';
import { Kbd } from '../../ui/Kbd';
import { SkinIcon } from '../SkinIcon';
import { HoloMenu, type HoloMenuSpec } from './HoloMenu';
import { HoloWindowControls } from './HoloWindowControls';

const MENUS: HoloMenuSpec[] = [
	{ label: 'File', code: 'SYS.F1', categories: ['File'] },
	{ label: 'Edit', code: 'SYS.E2', categories: ['Edit'] },
	{ label: 'View', code: 'SYS.V3', categories: ['View'] },
	{ label: 'Go', code: 'NAV.G4', categories: ['Go'] },
	{ label: 'Run', code: 'ENG.R5', categories: ['Run', 'Python', 'Terminal'] },
	{ label: 'AI', code: 'CORE.A6', categories: ['AI'] },
	{ label: 'Git', code: 'NAV.G7', categories: ['Git'] },
	{ label: 'Tools', code: 'AUX.T8', categories: ['Tools', 'Anvil'] },
];

/**
 * The bridge header: ANVIL//CORE with a live status diode, menus as small angled tabs, the
 * workspace as a SECTOR readout (opens quick open) and hexagonal window keys. Draggable.
 */
export function HoloTitleBar(): JSX.Element {
	const { info } = useWorkspace();
	const openQuick = useUiStore((s) => s.openQuickOpen);
	const layout = useLayoutStore();
	return (
		<header data-part='titlebar' className='ho-titlebar drag'>
			<div data-part='brand' className='ho-brand'>
				<span className='ho-diode' aria-hidden />
				<span className='ho-brand-name'>ANVIL</span>
				<span className='ho-brand-core'>{'//CORE'}</span>
			</div>
			<nav data-part='menubar' className='ho-menubar' aria-label='Menu'>
				{MENUS.map((m) => (
					<HoloMenu key={m.label} {...m} />
				))}
			</nav>

			<button
				type='button'
				data-part='command-center'
				onClick={() => openQuick('')}
				className='ho-sector no-drag'
			>
				<span className='ho-sector-tag'>SECTOR</span>
				<span className='ho-sector-name'>{info.name ?? 'no workspace'}</span>
				<span className='ho-sector-hint'>files · commands · symbols · AI</span>
				<Kbd keys={shortcutFor('file.quickOpen') ?? 'Ctrl+P'} />
			</button>

			<div data-part='title-actions' className='ho-title-actions no-drag'>
				<PythonEnvChip compact />
				<IconButton
					size='sm'
					label='Run Python file'
					shortcut={shortcutFor('python.runFile')}
					icon={<SkinIcon name='play' size={12} className='fill-current text-up' />}
					onClick={() => runCommandById('python.runFile')}
				/>
				<span className='ho-title-rule' aria-hidden />
				<IconButton
					size='sm'
					label='Toggle side bar'
					shortcut={shortcutFor('view.toggleSide')}
					toggle
					active={layout.sideOpen}
					icon={<SkinIcon name='sidebar' size={15} />}
					onClick={layout.toggleSide}
				/>
				<IconButton
					size='sm'
					label='Toggle panel'
					shortcut={shortcutFor('view.togglePanel')}
					toggle
					active={layout.panelOpen}
					icon={<SkinIcon name='panel' size={15} />}
					onClick={() => layout.togglePanel()}
				/>
				<IconButton
					size='sm'
					label='Toggle AI'
					shortcut={shortcutFor('view.toggleAi')}
					toggle
					active={layout.aiOpen}
					icon={<SkinIcon name='ai' size={16} />}
					onClick={() => layout.toggleAi()}
				/>
				<IconButton
					size='sm'
					label='Settings'
					shortcut={shortcutFor('anvil.settings')}
					icon={<SkinIcon name='settings' size={16} />}
					onClick={() => runCommandById('anvil.settings')}
				/>
			</div>
			<HoloWindowControls />
		</header>
	);
}
