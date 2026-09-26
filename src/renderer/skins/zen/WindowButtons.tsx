import type { JSX } from 'react';

import { useWindowState, windowActions } from '../../app/hooks/use-window-state';
import { SkinIcon } from '../SkinIcon';

/**
 * Minimize, maximize and close as three hairline rings; the glyph inside is inked in only when
 * you reach for them, and close fills with the seal color.
 */
export function WindowButtons(): JSX.Element {
	const state = useWindowState();
	const buttons = [
		{ action: 'minimize', label: 'Minimize', icon: 'minimize', run: windowActions.minimize },
		{
			action: 'maximize',
			label: state.maximized ? 'Restore' : 'Maximize',
			icon: state.maximized ? 'restore' : 'maximize',
			run: windowActions.toggleMaximize,
		},
		{ action: 'close', label: 'Close', icon: 'close', run: windowActions.close },
	] as const;
	return (
		<div
			data-part='window-controls'
			className='no-drag flex h-full items-center gap-2.5 pr-4 pl-2'
		>
			{buttons.map((b) => (
				<button
					key={b.action}
					type='button'
					aria-label={b.label}
					title={b.label}
					data-part='window-button'
					data-action={b.action}
					onClick={b.run}
					className='flex size-[13px] items-center justify-center rounded-full outline-none'
				>
					<SkinIcon name={b.icon} size={9} />
				</button>
			))}
		</div>
	);
}
