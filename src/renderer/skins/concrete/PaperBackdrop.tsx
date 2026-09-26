import type { JSX } from 'react';

/**
 * Flat paper under the panes: a faint layout grid, a halftone screen (full effects only) and
 * registration marks in the gutters, the way a print sheet looks before it is trimmed.
 */
export function PaperBackdrop(): JSX.Element {
	return (
		<div className='cc-paper' aria-hidden>
			<span className='cc-reg cc-reg-bl' />
			<span className='cc-reg cc-reg-br' />
		</div>
	);
}
