import type { JSX } from 'react';

import type { PixelArt } from './pixel';
import { PixelIcon } from './PixelIcon';

/** One window on the taskbar; the one in front stays pressed in. */
export function TaskButton({
	art,
	label,
	title,
	pressed,
	onClick,
}: {
	art: PixelArt;
	label: string;
	title: string;
	pressed: boolean;
	onClick: () => void;
}): JSX.Element {
	return (
		<button
			type='button'
			aria-pressed={pressed}
			title={title}
			onClick={onClick}
			className='wb-task'
		>
			<PixelIcon art={art} />
			<span className='min-w-0 truncate'>{label}</span>
		</button>
	);
}
