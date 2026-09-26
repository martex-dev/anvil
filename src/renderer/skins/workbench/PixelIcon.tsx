import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { ART_SIZE, type PixelArt, runsOf } from './pixel';

/**
 * Draws a 16x16 pixel map as crisp rectangles. Pixel art only survives whole-number scaling,
 * so any requested size is snapped to 16px (or 32px for big icons).
 */
export function PixelIcon({
	art,
	size = ART_SIZE,
	className,
}: {
	art: PixelArt;
	size?: number;
	className?: string | undefined;
}): JSX.Element {
	const px = size >= 28 ? ART_SIZE * 2 : ART_SIZE;
	return (
		<svg
			aria-hidden
			width={px}
			height={px}
			viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}
			shapeRendering='crispEdges'
			className={cn('wb-pixel shrink-0', className)}
		>
			{runsOf(art).map((r) => (
				<rect
					key={`${r.x}-${r.y}`}
					x={r.x}
					y={r.y}
					width={r.width}
					height={1}
					fill={r.fill}
				/>
			))}
		</svg>
	);
}
