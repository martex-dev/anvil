import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';

/** A status-strip cell: a button when it does something, otherwise a plain readout. */
export function StatusCell({
	children,
	onClick,
	title,
	tag,
	className,
}: {
	children: ReactNode;
	onClick?: () => void;
	title?: string;
	/** Tiny Orbitron code in front of the value ('CPU', 'T+'). */
	tag?: string;
	className?: string;
}): JSX.Element {
	const Tag = onClick ? 'button' : 'span';
	return (
		<Tag
			{...(onClick ? { type: 'button' as const, onClick } : {})}
			title={title}
			data-part='status-item'
			className={cn('ho-cell', onClick && 'ho-cell-action', className)}
		>
			{tag && <span className='ho-cell-tag'>{tag}</span>}
			{children}
		</Tag>
	);
}
