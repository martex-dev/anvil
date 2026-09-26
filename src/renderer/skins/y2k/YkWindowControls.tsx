import type { JSX } from 'react';

import { useWindowState, windowActions } from '../../app/hooks/use-window-state';
import { SkinIcon } from '../SkinIcon';

/**
 * Minimize, maximize and close as three glossy jelly orbs (amber, lime, cherry). Close stays at
 * the far right, where Windows hands expect it; each glyph surfaces on hover or focus.
 */
export function YkWindowControls(): JSX.Element {
	const state = useWindowState();
	return (
		<div
			data-part='window-controls'
			data-focused={state.focused}
			className='no-drag yk-orbs flex items-center gap-1.5'
		>
			<button
				type='button'
				aria-label='Minimize'
				title='Minimize'
				data-part='window-button'
				data-action='minimize'
				onClick={windowActions.minimize}
				className='yk-orb'
			>
				<SkinIcon name='minimize' size={10} />
			</button>
			<button
				type='button'
				aria-label={state.maximized ? 'Restore' : 'Maximize'}
				title={state.maximized ? 'Restore' : 'Maximize'}
				data-part='window-button'
				data-action='maximize'
				onClick={windowActions.toggleMaximize}
				className='yk-orb'
			>
				<SkinIcon name={state.maximized ? 'restore' : 'maximize'} size={10} />
			</button>
			<button
				type='button'
				aria-label='Close'
				title='Close'
				data-part='window-button'
				data-action='close'
				onClick={windowActions.close}
				className='yk-orb'
			>
				<SkinIcon name='close' size={10} />
			</button>
		</div>
	);
}
