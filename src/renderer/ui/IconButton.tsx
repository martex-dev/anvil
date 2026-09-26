import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** Accessible name; also shown as the tooltip. */
	label: string;
	shortcut?: string;
	icon: ReactNode;
	size?: 'sm' | 'md';
	active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
	{ label, shortcut, icon, size = 'md', active = false, className, ...rest },
	ref,
) {
	return (
		<Tooltip content={label} shortcut={shortcut}>
			<button
				ref={ref}
				type='button'
				aria-label={label}
				aria-pressed={active || undefined}
				className={cn(
					'inline-flex items-center justify-center rounded-md text-fg-1',
					'transition-[background-color,color] transition-fast',
					'hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none',
					'disabled:pointer-events-none disabled:opacity-40',
					active && 'bg-accent-soft text-accent',
					size === 'sm' ? 'size-6' : 'size-7',
					className,
				)}
				{...rest}
			>
				{icon}
			</button>
		</Tooltip>
	);
});
