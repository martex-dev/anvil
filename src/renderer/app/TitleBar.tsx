import { Minimize2 } from 'lucide-react';
import type { JSX } from 'react';

import { WINDOW_CHROME } from '@shared/constants';

import { PythonEnvChip } from '../features/python/PythonEnvChip';
import { cn } from '../lib/cn';
import { SkinIcon } from '../skins/SkinIcon';
import { useLayoutStore } from '../stores/layout-store';
import { useUiStore } from '../stores/ui-store';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';
import { runCommandById, shortcutFor } from './commands/run';
import { useWorkspace } from './hooks/use-workspace';
import { TitleMenus } from './TitleMenus';
import { WindowControls } from './WindowControls';

/** Default title bar height; skins may draw a taller or shorter one. */
export const TITLE_BAR_HEIGHT = WINDOW_CHROME.titleBarHeight;

export function TitleBar(): JSX.Element {
	const { info } = useWorkspace();
	const openQuick = useUiStore((s) => s.openQuickOpen);
	const sideOpen = useLayoutStore((s) => s.sideOpen);
	const panelOpen = useLayoutStore((s) => s.panelOpen);
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	// Zen hides the panes, so the toggles show what is visible, not what is remembered.
	const zen = useLayoutStore((s) => s.zen);
	return (
		<header
			data-part='titlebar'
			className='drag relative z-20 flex shrink-0 items-center gap-2 pl-3'
			style={{ height: TITLE_BAR_HEIGHT }}
		>
			<div data-part='brand' className='flex items-center gap-2.5 pr-2'>
				<span aria-hidden className='relative flex size-4 items-center justify-center'>
					<span className='absolute size-3 rotate-45 accent-gradient shadow-glow' />
					<span className='absolute size-1.5 rotate-45 bg-bg-0' />
				</span>
				<span className='text-gradient font-mono text-13 font-bold tracking-[0.32em]'>
					ANVIL
				</span>
			</div>
			<TitleMenus />

			{/* In the flow, not absolutely centered: on narrower windows it shrinks instead of
			    drawing over the menus and the chips on the right. */}
			<button
				type='button'
				data-part='command-center'
				onClick={() => openQuick('')}
				className={cn(
					'no-drag group mx-auto flex h-7 max-w-[520px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-glass-edge bg-bg-2/50 px-3 text-12 text-fg-2 glass-blur',
					'transition-[border-color,box-shadow,color] transition-fast hover:border-accent/40 hover:text-fg-1 hover:shadow-glow-soft focus-visible:shadow-glow focus-visible:outline-none',
				)}
			>
				<SkinIcon name='search' size={13} className='group-hover:text-accent' />
				<span className='truncate'>
					<span className='text-fg-1'>{info.name ?? 'anvil'}</span>
					<span className='mx-1.5 opacity-50'>/</span>
					files, &gt; commands, @ symbols, : line
				</span>
				<span className='flex-1' />
				<Kbd keys={shortcutFor('file.quickOpen') ?? 'Ctrl+P'} />
			</button>

			<div data-part='title-actions' className='no-drag ml-auto flex items-center gap-1'>
				<PythonEnvChip compact />
				<IconButton
					size='sm'
					label='Run Python file'
					shortcut={shortcutFor('python.runFile')}
					icon={<SkinIcon name='play' size={13} className='fill-current text-up' />}
					onClick={() => runCommandById('python.runFile')}
				/>
				<span className='mx-1 h-4 w-px bg-glass-edge' />
				{zen && (
					<IconButton
						size='sm'
						label='Exit Zen mode'
						shortcut={shortcutFor('view.zen')}
						icon={<Minimize2 size={14} />}
						onClick={() => useLayoutStore.getState().toggleZen()}
					/>
				)}
				<IconButton
					size='sm'
					label='Toggle side bar'
					shortcut={shortcutFor('view.toggleSide')}
					toggle
					active={sideOpen && !zen}
					icon={<SkinIcon name='sidebar' size={14} />}
					onClick={() => useLayoutStore.getState().toggleSide()}
				/>
				<IconButton
					size='sm'
					label='Toggle panel'
					shortcut={shortcutFor('view.togglePanel')}
					toggle
					active={panelOpen && !zen}
					icon={<SkinIcon name='panel' size={14} />}
					onClick={() => useLayoutStore.getState().togglePanel()}
				/>
				<IconButton
					size='sm'
					label='Toggle AI'
					shortcut={shortcutFor('view.toggleAi')}
					toggle
					active={aiOpen && !zen}
					icon={<SkinIcon name='ai' size={14} />}
					onClick={() => useLayoutStore.getState().toggleAi()}
				/>
				<IconButton
					size='sm'
					label='Settings'
					shortcut={shortcutFor('anvil.settings')}
					icon={<SkinIcon name='settings' size={14} />}
					onClick={() => runCommandById('anvil.settings')}
				/>
			</div>
			<WindowControls />
		</header>
	);
}
