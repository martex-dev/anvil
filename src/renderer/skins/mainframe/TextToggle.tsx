import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { Tooltip } from '../../ui/Tooltip';

/** A bracketed text switch (`[SB]`), shown in reverse video while on. */
export function TextToggle({
	text,
	label,
	shortcut,
	active,
	onClick,
}: {
	text: string;
	label: string;
	shortcut?: string | undefined;
	active?: boolean;
	onClick: () => void;
}): JSX.Element {
	return (
		<Tooltip content={label} shortcut={shortcut}>
			<button
				type='button'
				aria-label={label}
				aria-pressed={active}
				data-active={active}
				onClick={onClick}
				className={cn('mf-toggle no-drag', active && 'mf-rev')}
			>
				{text}
			</button>
		</Tooltip>
	);
}
