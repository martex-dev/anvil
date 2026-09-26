import type { JSX } from 'react';

/**
 * Deep space behind the glass: the ambient glows and grid, a drifting aurora, two layers of
 * stars and a perspective neon floor running to the horizon. Everything is CSS (cyber/skin.css)
 * so it costs a few composited layers, and it holds still with effects off or subtle.
 */
export function CyberBackdrop(): JSX.Element {
	return (
		<div className='ambient' aria-hidden data-part='backdrop'>
			<span className='cy-aurora cy-aurora-a' />
			<span className='cy-aurora cy-aurora-b' />
			<span className='cy-stars cy-stars-far' />
			<span className='cy-stars cy-stars-near' />
			<span className='cy-horizon' />
			<span className='cy-floor' />
		</div>
	);
}
