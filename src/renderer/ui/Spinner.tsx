import type { JSX } from 'react';

import { cn } from '@renderer/lib/cn';

interface SpinnerProps {
	size?: 12 | 16 | 24;
	className?: string;
	label?: string;
}

export function Spinner({ size = 16, className, label = 'Loading' }: SpinnerProps): JSX.Element {
	return (
		<span
			role='status'
			aria-label={label}
			className={cn(
				'inline-block animate-spin rounded-full border-2 border-border-strong border-t-accent',
				'motion-reduce:animate-none',
				className,
			)}
			style={{ width: size, height: size }}
		/>
	);
}
