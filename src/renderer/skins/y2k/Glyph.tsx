import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';

/**
 * The frame every Y2K icon is drawn in: a 24px grid, chunky 2.2 strokes with round caps, so
 * glyphs read like soft rubber toys rather than hairline wireframes.
 */
export function Glyph({
	size,
	className,
	children,
}: {
	size: number;
	className?: string | undefined;
	children: ReactNode;
}): JSX.Element {
	return (
		<svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth={2.2}
			strokeLinecap='round'
			strokeLinejoin='round'
			aria-hidden
			className={cn('yk-glyph', className)}
		>
			{children}
		</svg>
	);
}
