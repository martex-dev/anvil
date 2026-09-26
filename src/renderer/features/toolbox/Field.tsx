import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';

interface FieldProps {
	label: string;
	/** Extra content aligned right of the label, e.g. a byte count. */
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
}

export function Field({ label, aside, children, className }: FieldProps): JSX.Element {
	return (
		<label className={cn('flex min-w-0 flex-col gap-1', className)}>
			<span className='flex items-center justify-between gap-2'>
				<span className='hud'>{label}</span>
				{aside && <span className='text-11 text-fg-2'>{aside}</span>}
			</span>
			{children}
		</label>
	);
}
