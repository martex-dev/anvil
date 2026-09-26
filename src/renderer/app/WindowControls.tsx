import type { JSX } from 'react';

import { chromeFor } from '../skins/chrome-registry';
import { useLook } from '../skins/look-store';
import { SkinIcon } from '../skins/SkinIcon';
import { useWindowState, windowActions } from './hooks/use-window-state';

/**
 * Minimize / maximize / close. The window is frameless, so these are ours: skins restyle them
 * through `[data-part='window-button']`, or replace the whole group.
 */
export function WindowControls(): JSX.Element {
	const { skin } = useLook();
	const Custom = chromeFor(skin.id).WindowControls;
	const state = useWindowState();
	if (Custom) return <Custom />;
	return (
		<div data-part='window-controls' className='no-drag flex h-full items-stretch self-stretch'>
			<button
				type='button'
				aria-label='Minimize'
				data-part='window-button'
				data-action='minimize'
				onClick={windowActions.minimize}
				className='flex w-11 items-center justify-center text-fg-1 outline-none transition-colors transition-fast hover:bg-bg-3 hover:text-fg-0 focus-visible:bg-bg-3'
			>
				<SkinIcon name='minimize' size={14} />
			</button>
			<button
				type='button'
				aria-label={state.maximized ? 'Restore' : 'Maximize'}
				data-part='window-button'
				data-action='maximize'
				onClick={windowActions.toggleMaximize}
				className='flex w-11 items-center justify-center text-fg-1 outline-none transition-colors transition-fast hover:bg-bg-3 hover:text-fg-0 focus-visible:bg-bg-3'
			>
				<SkinIcon name={state.maximized ? 'restore' : 'maximize'} size={12} />
			</button>
			<button
				type='button'
				aria-label='Close'
				data-part='window-button'
				data-action='close'
				onClick={windowActions.close}
				className='flex w-11 items-center justify-center text-fg-1 outline-none transition-colors transition-fast hover:bg-down hover:text-on-accent focus-visible:bg-down'
			>
				<SkinIcon name='close' size={15} />
			</button>
		</div>
	);
}
