import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { PythonEnvChip } from '../../features/python/PythonEnvChip';
import { useLayoutStore } from '../../stores/layout-store';
import { useUiStore } from '../../stores/ui-store';
import { IconButton } from '../../ui/IconButton';
import { Kbd } from '../../ui/Kbd';
import { SkinIcon } from '../SkinIcon';
import { MENUS } from './menus';
import { YkMenu } from './YkMenu';
import { YkWindowControls } from './YkWindowControls';

/** Taller than the default bar: the chrome wordmark and jelly pills need room to shine. */
const HEIGHT = 50;

/**
 * A brushed-chrome, pinstriped title bar: a jelly gem and liquid-metal "Anvil" wordmark, menus
 * as small glossy pills, a sunken search capsule in the middle and three jelly orbs at the right.
 * The bar itself drags the window; every control opts out with `no-drag`.
 */
export function YkTitleBar(): JSX.Element {
	const { info } = useWorkspace();
	const openQuick = useUiStore((s) => s.openQuickOpen);
	const layout = useLayoutStore();
	return (
		<header
			data-part='titlebar'
			className='drag yk-titlebar relative z-20 flex shrink-0 items-center gap-3 pr-3.5 pl-3'
			style={{ height: HEIGHT }}
		>
			<div data-part='brand' className='flex shrink-0 items-center gap-2 pr-1'>
				<span aria-hidden className='yk-gem' />
				<span className='yk-wordmark' data-text='Anvil'>
					Anvil
				</span>
				<span aria-hidden className='yk-wordmark-star' />
			</div>
			<nav
				data-part='menubar'
				className='yk-menubar flex shrink-0 items-center gap-0.5'
				aria-label='Menu'
			>
				{MENUS.map((m) => (
					<YkMenu key={m.label} label={m.label} categories={m.categories} />
				))}
			</nav>

			<div className='flex min-w-0 flex-1 justify-center'>
				<button
					type='button'
					data-part='command-center'
					onClick={() => openQuick('')}
					className='no-drag yk-search group flex h-8 w-full max-w-[440px] min-w-0 items-center gap-2 px-3.5 text-12'
				>
					<SkinIcon name='search' size={15} className='yk-search-icon shrink-0' />
					<span className='truncate'>
						<span className='font-bold text-fg-0'>{info.name ?? 'anvil'}</span>
						<span className='mx-1.5 text-fg-2'>·</span>
						<span className='text-fg-1'>files, commands, symbols, AI</span>
					</span>
					<span className='flex-1' />
					<Kbd keys={shortcutFor('file.quickOpen') ?? 'Ctrl+P'} />
				</button>
			</div>

			<div data-part='title-actions' className='no-drag flex shrink-0 items-center gap-1.5'>
				<PythonEnvChip compact />
				<IconButton
					size='md'
					label='Run Python file'
					shortcut={shortcutFor('python.runFile')}
					icon={<SkinIcon name='play' size={14} className='text-up' />}
					onClick={() => runCommandById('python.runFile')}
				/>
				<span aria-hidden className='yk-divot' />
				<IconButton
					size='md'
					label='Toggle side bar'
					shortcut={shortcutFor('view.toggleSide')}
					toggle
					active={layout.sideOpen}
					icon={<SkinIcon name='sidebar' size={15} />}
					onClick={layout.toggleSide}
				/>
				<IconButton
					size='md'
					label='Toggle panel'
					shortcut={shortcutFor('view.togglePanel')}
					toggle
					active={layout.panelOpen}
					icon={<SkinIcon name='panel' size={15} />}
					onClick={() => layout.togglePanel()}
				/>
				<IconButton
					size='md'
					label='Toggle AI'
					shortcut={shortcutFor('view.toggleAi')}
					toggle
					active={layout.aiOpen}
					icon={<SkinIcon name='ai' size={15} />}
					onClick={() => layout.toggleAi()}
				/>
				<IconButton
					size='md'
					label='Settings'
					shortcut={shortcutFor('anvil.settings')}
					icon={<SkinIcon name='settings' size={15} />}
					onClick={() => runCommandById('anvil.settings')}
				/>
			</div>
			<YkWindowControls />
		</header>
	);
}
