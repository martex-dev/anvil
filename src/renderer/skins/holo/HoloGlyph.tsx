import type { JSX } from 'react';

import type { IconProps } from '../types';

/** The instrument frames a glyph can sit in. */
export type GlyphFrame = 'hex' | 'diamond' | 'triangle' | 'none';

const FRAMES: Record<Exclude<GlyphFrame, 'none'>, string> = {
	hex: 'M12 1.8 21.2 7.1V16.9L12 22.2 2.8 16.9V7.1Z',
	diamond: 'M12 1.6 22.4 12 12 22.4 1.6 12Z',
	triangle: 'M12 2.6 21.8 20.4H2.2Z',
};

/**
 * One Holo HUD icon: a thin geometric glyph, optionally inside a faint instrument frame with a
 * brighter tick on top, like a sensor readout. Draws in currentColor.
 */
export function HoloGlyph({
	d,
	frame,
	size,
	className,
}: IconProps & { d: string; frame: GlyphFrame }): JSX.Element {
	return (
		<svg
			aria-hidden
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth={1.5}
			strokeLinecap='square'
			strokeLinejoin='miter'
			className={className}
		>
			{frame !== 'none' && (
				<>
					<path d={FRAMES[frame]} strokeWidth={1} opacity={0.45} />
					<path d={frame === 'hex' ? 'M9 3.5 12 1.8 15 3.5' : 'M10 3.6 12 1.6 14 3.6'} />
				</>
			)}
			<path d={d} />
		</svg>
	);
}
