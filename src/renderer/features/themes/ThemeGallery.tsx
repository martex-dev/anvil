import type { JSX } from 'react';

import type { PaletteMeta } from '../../skins/types';
import { ThemeCard } from './ThemeCard';

/** The color variants of one skin as live mini-editors. */
export function ThemeGallery({
	palettes,
	value,
	onChange,
}: {
	palettes: readonly PaletteMeta[];
	value: string;
	onChange: (id: string) => void;
}): JSX.Element {
	return (
		<div role='group' aria-label='Color variant' className='grid grid-cols-3 gap-2.5 py-3'>
			{palettes.map((p) => (
				<ThemeCard
					key={p.id}
					theme={p}
					selected={p.id === value}
					onSelect={() => onChange(p.id)}
				/>
			))}
		</div>
	);
}
