import type { JSX } from 'react';

import { themeById, THEMES } from '../../styles/theme-list';
import { ThemeCard } from './ThemeCard';

export function ThemeGallery({
	value,
	onChange,
}: {
	value: string;
	onChange: (id: string) => void;
}): JSX.Element {
	const current = themeById(value).id;
	return (
		<div role='group' aria-label='Color theme' className='grid grid-cols-3 gap-2.5 py-3'>
			{THEMES.map((t) => (
				<ThemeCard
					key={t.id}
					theme={t}
					selected={t.id === current}
					onSelect={() => onChange(t.id)}
				/>
			))}
		</div>
	);
}
