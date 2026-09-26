import type { JSX } from 'react';

import { useWindowState, windowActions } from '../../app/hooks/use-window-state';
import { SkinIcon } from '../SkinIcon';

/** Minimize / maximize / close as angled hexagonal keys; close lights up red. */
export function HoloWindowControls(): JSX.Element {
	const state = useWindowState();
	return (
		<div data-part='window-controls' className='ho-winctl no-drag'>
			<button
				type='button'
				aria-label='Minimize'
				data-part='window-button'
				data-action='minimize'
				onClick={windowActions.minimize}
			>
				<SkinIcon name='minimize' size={13} />
			</button>
			<button
				type='button'
				aria-label={state.maximized ? 'Restore' : 'Maximize'}
				data-part='window-button'
				data-action='maximize'
				onClick={windowActions.toggleMaximize}
			>
				<SkinIcon name={state.maximized ? 'restore' : 'maximize'} size={13} />
			</button>
			<button
				type='button'
				aria-label='Close'
				data-part='window-button'
				data-action='close'
				onClick={windowActions.close}
			>
				<SkinIcon name='close' size={13} />
			</button>
		</div>
	);
}
