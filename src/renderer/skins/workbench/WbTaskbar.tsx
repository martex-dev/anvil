import type { JSX } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { useUiStore } from '../../stores/ui-store';
import { ANVIL } from './art-tools';
import { PixelIcon } from './PixelIcon';
import { TaskList } from './TaskList';
import { WbTray } from './WbTray';

/** The taskbar: Start (the command palette), one button per open window, and the tray. */
export function WbTaskbar(): JSX.Element {
	const paletteOpen = useUiStore((s) => s.paletteOpen);
	const shortcut = shortcutFor('view.palette') ?? 'Ctrl+Shift+P';
	return (
		<div data-part='taskbar' className='wb-taskbar relative z-10 shrink-0'>
			<button
				type='button'
				aria-pressed={paletteOpen}
				aria-label={`Start: all commands (${shortcut})`}
				title={`All commands (${shortcut})`}
				onClick={() => useUiStore.getState().setPaletteOpen(true)}
				className='wb-start'
			>
				<PixelIcon art={ANVIL} />
				<span>Start</span>
			</button>
			<span aria-hidden className='wb-tool-separator' />
			<TaskList />
			<WbTray />
		</div>
	);
}
