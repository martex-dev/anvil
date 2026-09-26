import type { JSX } from 'react';

/**
 * The glass of the tube, drawn over everything with pointer events off: scanlines, a curved
 * vignette and (at full effects) a faint flicker. On the greenbar palette it becomes a light
 * paper shading instead. All of it is CSS, keyed on data-fx and data-kind.
 */
export function CrtOverlay(): JSX.Element {
	return (
		<div aria-hidden data-part='crt' className='mf-crt'>
			<span className='mf-crt-scan' />
			<span className='mf-crt-vignette' />
			<span className='mf-crt-flicker' />
		</div>
	);
}
