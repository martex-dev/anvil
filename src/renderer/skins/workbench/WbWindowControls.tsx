import type { JSX } from 'react';

import { useWindowState, windowActions } from '../../app/hooks/use-window-state';
import { CLOSE, MAXIMIZE, MINIMIZE, RESTORE } from './art-glyphs';
import { PixelIcon } from './PixelIcon';

/** [_][□][X]: bevelled caption buttons that press in, close set apart by a gap. */
export function WbWindowControls(): JSX.Element {
	const { maximized } = useWindowState();
	return (
		<div data-part='window-controls' className='wb-window-controls no-drag'>
			<button
				type='button'
				aria-label='Minimize'
				title='Minimize'
				data-part='window-button'
				data-action='minimize'
				onClick={windowActions.minimize}
				className='wb-caption-button'
			>
				<PixelIcon art={MINIMIZE} />
			</button>
			<button
				type='button'
				aria-label={maximized ? 'Restore' : 'Maximize'}
				title={maximized ? 'Restore' : 'Maximize'}
				data-part='window-button'
				data-action='maximize'
				onClick={windowActions.toggleMaximize}
				className='wb-caption-button'
			>
				<PixelIcon art={maximized ? RESTORE : MAXIMIZE} />
			</button>
			<button
				type='button'
				aria-label='Close'
				title='Close'
				data-part='window-button'
				data-action='close'
				onClick={windowActions.close}
				className='wb-caption-button ml-[2px]'
			>
				<PixelIcon art={CLOSE} />
			</button>
		</div>
	);
}
