import type { JSX } from 'react';

import { useWindowState, windowActions } from '../../app/hooks/use-window-state';
import { SkinIcon } from '../SkinIcon';

/** Square window keys, ruled like the rest of the desk; close lights up in the down color. */
export function DeskWindowControls(): JSX.Element {
	const state = useWindowState();
	const max = state.maximized ? 'Restore' : 'Maximize';
	return (
		<div data-part='window-controls' className='ck-winkeys no-drag'>
			<button
				type='button'
				aria-label='Minimize'
				title='Minimize'
				data-part='window-button'
				data-action='minimize'
				onClick={windowActions.minimize}
			>
				<SkinIcon name='minimize' size={12} />
			</button>
			<button
				type='button'
				aria-label={max}
				title={max}
				data-part='window-button'
				data-action='maximize'
				onClick={windowActions.toggleMaximize}
			>
				<SkinIcon name={state.maximized ? 'restore' : 'maximize'} size={12} />
			</button>
			<button
				type='button'
				aria-label='Close'
				title='Close'
				data-part='window-button'
				data-action='close'
				onClick={windowActions.close}
			>
				<SkinIcon name='close' size={12} />
			</button>
		</div>
	);
}
