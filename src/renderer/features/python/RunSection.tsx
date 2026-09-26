import type { JSX, ReactNode } from 'react';

/** One titled block of the Run view, with an optional header action. */
export function RunSection({
	title,
	action,
	children,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
}): JSX.Element {
	return (
		<section className='border-b border-glass-edge px-3 py-2.5'>
			<div className='mb-2 flex items-center gap-2'>
				<h3 className='hud flex-1'>{title}</h3>
				{action}
			</div>
			{children}
		</section>
	);
}
