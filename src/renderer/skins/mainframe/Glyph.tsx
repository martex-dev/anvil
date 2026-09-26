import type { JSX } from 'react';

import { cn } from '../../lib/cn';

/**
 * One character cell used as an icon. Text-mode programs had no pictures, only glyphs, so every
 * chrome icon in Mainframe is a character sized to the icon box.
 */
export function Glyph({
	char,
	size,
	className,
}: {
	char: string;
	size: number;
	className?: string | undefined;
}): JSX.Element {
	return (
		<span
			aria-hidden
			data-glyph={char}
			className={cn('mf-glyph', className)}
			style={{ fontSize: Math.round(size * 1.05), minWidth: size, height: size }}
		>
			{char}
		</span>
	);
}
