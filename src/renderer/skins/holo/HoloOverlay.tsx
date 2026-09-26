import type { JSX } from 'react';

/** Faint interlace and an occasional scan sweep over the whole display (effects: full only). */
export function HoloOverlay(): JSX.Element {
	return (
		<div className='ho-overlay' aria-hidden>
			<div className='ho-scanbeam' />
		</div>
	);
}
