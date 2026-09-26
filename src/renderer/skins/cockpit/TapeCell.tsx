import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';

interface TapeCellProps {
	children: ReactNode;
	onClick?: () => void;
	title?: string;
	className?: string;
}

/** One ruled cell of the status tape; a button when it does something. */
export function TapeCell({ children, onClick, title, className }: TapeCellProps): JSX.Element {
	const Tag = onClick ? 'button' : 'span';
	return (
		<Tag
			{...(onClick ? { type: 'button' as const, onClick } : {})}
			title={title}
			data-part='status-item'
			className={cn('ck-cell', onClick && 'ck-cell-btn', className)}
		>
			{children}
		</Tag>
	);
}
