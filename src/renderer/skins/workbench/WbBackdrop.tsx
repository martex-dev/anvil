import { type JSX, useEffect } from 'react';

import { useLook } from '../look-store';

/**
 * The program's own window frame: a raised grey edge around everything, never clickable. It
 * also tells the skin's CSS which UI font is active (fonts.css swaps Pixelify's digits).
 */
export function WbBackdrop(): JSX.Element {
	const { uiFontId } = useLook();
	useEffect(() => {
		const root = document.documentElement;
		root.dataset['wbUi'] = uiFontId;
		return () => {
			delete root.dataset['wbUi'];
		};
	}, [uiFontId]);
	return <div aria-hidden className='wb-frame' />;
}
