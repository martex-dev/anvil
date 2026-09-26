import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';

interface ColophonItemProps {
	children: ReactNode;
	onClick?: () => void;
	title?: string;
	className?: string;
}

/** One phrase of the colophon line; a quiet text button when it does something. */
export function ColophonItem({
	children,
	onClick,
	title,
	className,
}: ColophonItemProps): JSX.Element {
	if (!onClick)
		return (
			<span
				data-part='status-item'
				title={title}
				className={cn('whitespace-nowrap', className)}
			>
				{children}
			</span>
		);
	return (
		<button
			type='button'
			data-part='status-item'
			data-zen='link'
			title={title}
			onClick={onClick}
			className={cn('whitespace-nowrap outline-none', className)}
		>
			{children}
		</button>
	);
}
