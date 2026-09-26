import type { JSX, ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps): JSX.Element {
	return (
		<div
			className={cn(
				'flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center',
				className,
			)}
		>
			{icon && <div className='mb-1 text-fg-2'>{icon}</div>}
			<p className='text-14 font-medium text-fg-0'>{title}</p>
			{description && <p className='max-w-80 text-12 text-fg-2'>{description}</p>}
			{action && <div className='mt-2'>{action}</div>}
		</div>
	);
}
