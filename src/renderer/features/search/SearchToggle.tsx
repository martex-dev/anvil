import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Tooltip } from '../../ui/Tooltip';

/** An option toggle beside the search box (match case, whole word, regex, globs). */
export function SearchToggle({
	label,
	pressed,
	onClick,
	dot = false,
	children,
}: {
	label: string;
	pressed: boolean;
	onClick: () => void;
	/** Marks a setting that is in effect although its toggle is off (hidden glob filters). */
	dot?: boolean;
	children: ReactNode;
}): JSX.Element {
	return (
		<Tooltip content={label}>
			<button
				type='button'
				aria-label={label}
				aria-pressed={pressed}
				onClick={onClick}
				className={cn(
					'relative flex size-5 items-center justify-center rounded-sm',
					'transition-[background-color,color] transition-fast',
					'focus-visible:shadow-glow focus-visible:outline-none',
					pressed
						? 'bg-accent-soft text-accent'
						: 'text-fg-2 hover:bg-bg-3 hover:text-fg-0',
				)}
			>
				{children}
				{dot && (
					<span
						aria-hidden
						className='absolute top-0.5 right-0.5 size-1 rounded-full bg-accent'
					/>
				)}
			</button>
		</Tooltip>
	);
}
