import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';

interface FieldProps {
	label: string;
	/** Extra content aligned right of the label, e.g. a byte count. */
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
	/**
	 * 'div' for children a <label> can't activate properly, like a Radix Select (it opens on
	 * pointerdown, so a label's synthetic click is ignored after the first mouse use). Such
	 * children must carry their own aria-label.
	 */
	as?: 'label' | 'div';
}

export function Field({
	label,
	aside,
	children,
	className,
	as: Tag = 'label',
}: FieldProps): JSX.Element {
	return (
		<Tag className={cn('flex min-w-0 flex-col gap-1', className)}>
			<span className='flex items-center justify-between gap-2'>
				<span className='hud'>{label}</span>
				{aside && <span className='text-11 text-fg-2'>{aside}</span>}
			</span>
			{children}
		</Tag>
	);
}
