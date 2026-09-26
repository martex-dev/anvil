import type { JSX } from 'react';

import { cn } from '../../lib/cn';

/**
 * The hedera, a printer's ivy leaf (the floral heart ❦). Drawn rather than typed: the bundled
 * serifs have no dingbats, and a fallback font's heart would be the one clumsy glyph on the
 * page. skin.css carries the same shape as a mask for ornaments drawn in CSS.
 */
export function Fleuron({ flip, className }: { flip?: boolean; className?: string }): JSX.Element {
	return (
		<svg
			aria-hidden
			viewBox='0 0 16 16'
			width='1em'
			height='1em'
			fill='currentColor'
			data-zen='fleuron'
			className={cn('inline-block shrink-0', flip && '-scale-x-100', className)}
		>
			<g transform='rotate(-28 8 8)'>
				<path
					fillRule='evenodd'
					d='M8 15.6C7 12.6 3 10.8 2.4 7.4 2 4.6 5.4 3.4 8 5.9c2.6-2.5 6-1.3 5.6 1.5-.6 3.4-4.6 5.2-5.6 8.2zM8 7.4 7.72 13h.56z'
				/>
				<path d='M7.6 6C7 3.6 8.2 1.2 11.4.8c1.2-.1 2 .6 1.8 1.6-.4-.8-1.2-1-2-.8C9 2 8.1 3.8 8.4 6z' />
			</g>
		</svg>
	);
}
