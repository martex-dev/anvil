import type { JSX } from 'react';

/** The program's own window frame: a raised grey edge around everything, never clickable. */
export function WbBackdrop(): JSX.Element {
	return <div aria-hidden className='wb-frame' />;
}
