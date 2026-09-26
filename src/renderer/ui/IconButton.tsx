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
	/**
	 * An on/off toggle with a fixed label: `aria-pressed` reflects `active` in both states. Leave
	 * it off for buttons whose label already says the state ("Hide column profile").
	 */
	toggle?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
	{ label, shortcut, icon, size = 'md', active = false, toggle = false, className, ...rest },
	ref,
) {
	return (
		<Tooltip content={label} shortcut={shortcut}>
			<button
				ref={ref}
				type='button'
				aria-label={label}
				aria-pressed={toggle ? active : undefined}
				// Style hook for skins: set for every active button, toggle or not.
				data-active={active || undefined}
				className={cn(
					'inline-flex items-center justify-center rounded-md text-fg-1',
					'transition-[background-color,color] transition-fast',
					'focus-visible:shadow-glow focus-visible:outline-none',
					'disabled:pointer-events-none disabled:opacity-40',
					// Hover variants win over plain utilities, so an active button keeps its look.
					active
						? 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent'
						: 'hover:bg-bg-3 hover:text-fg-0',
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
