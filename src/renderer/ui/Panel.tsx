import type { JSX, ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

interface PanelProps {
	title: ReactNode;
	icon?: ReactNode;
	actions?: ReactNode;
	/** Active panels get the thin accent top border. */
	active?: boolean;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
}

export function Panel({
	title,
	icon,
	actions,
	active = false,
	children,
	className,
	bodyClassName,
}: PanelProps): JSX.Element {
	return (
		<section
			className={cn(
				'flex h-full min-h-0 flex-col border border-border bg-bg-1',
				active ? 'border-t-accent' : 'border-t-border',
				className,
			)}
		>
			<header className='flex h-8 shrink-0 items-center gap-2 border-b border-border px-2'>
				{icon && <span className='text-fg-2'>{icon}</span>}
				<h2 className='min-w-0 flex-1 truncate text-12 font-medium tracking-wide text-fg-1 uppercase'>
					{title}
				</h2>
				{actions && <div className='flex items-center gap-0.5'>{actions}</div>}
			</header>
			<div className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>{children}</div>
		</section>
	);
}
