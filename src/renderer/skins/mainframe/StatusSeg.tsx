import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';

/**
 * One segment of the status line. Clickable segments are buttons; `rev` draws it in reverse
 * video (the tmux/airline block look).
 */
export function StatusSeg({
	children,
	onClick,
	title,
	rev,
	className,
}: {
	children: ReactNode;
	onClick?: (() => void) | undefined;
	title?: string | undefined;
	rev?: boolean | undefined;
	className?: string | undefined;
}): JSX.Element {
	const cls = cn('mf-seg', rev && 'mf-rev', className);
	if (onClick)
		return (
			<button
				type='button'
				data-part='status-item'
				title={title}
				onClick={onClick}
				className={cls}
			>
				{children}
			</button>
		);
	return (
		<span data-part='status-item' title={title} className={cls}>
			{children}
		</span>
	);
}
