import type { JSX } from 'react';

import { TargetingRing } from './TargetingRing';

/** Deep space behind the panes: a hex grid, a soft glow in the accent and the targeting ring. */
export function HoloBackdrop(): JSX.Element {
	return (
		<div className='ho-backdrop' aria-hidden>
			<svg className='ho-hexgrid' width='100%' height='100%'>
				<defs>
					<pattern id='ho-hex' width='24.25' height='42' patternUnits='userSpaceOnUse'>
						<path d='M12.12 0 24.25 7V21L12.12 28 0 21V7ZM12.12 28V42' />
					</pattern>
				</defs>
				<rect width='100%' height='100%' fill='url(#ho-hex)' />
			</svg>
			<TargetingRing />
		</div>
	);
}
