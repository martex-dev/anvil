import type { JSX } from 'react';

import { useWindowState, windowActions } from '../../app/hooks/use-window-state';

/** Window buttons as bracketed text cells: `[_] [□] [x]`. */
export function MfWindowControls(): JSX.Element {
	const state = useWindowState();
	return (
		<div data-part='window-controls' className='no-drag flex h-full items-stretch'>
			<button
				type='button'
				aria-label='Minimize'
				data-part='window-button'
				data-action='minimize'
				onClick={windowActions.minimize}
				className='mf-winbtn'
			>
				[_]
			</button>
			<button
				type='button'
				aria-label={state.maximized ? 'Restore' : 'Maximize'}
				data-part='window-button'
				data-action='maximize'
				onClick={windowActions.toggleMaximize}
				className='mf-winbtn'
			>
				{state.maximized ? '[▫]' : '[□]'}
			</button>
			<button
				type='button'
				aria-label='Close'
				data-part='window-button'
				data-action='close'
				onClick={windowActions.close}
				className='mf-winbtn'
			>
				[x]
			</button>
		</div>
	);
}
