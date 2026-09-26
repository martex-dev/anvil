import type { JSX } from 'react';

/** The tube face behind the panes: solid, with the faintest phosphor haze. No grid, no glow. */
export function MfBackdrop(): JSX.Element {
	return <div aria-hidden data-part='backdrop' className='mf-backdrop' />;
}
