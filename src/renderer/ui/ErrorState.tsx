import { TriangleAlert } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

import { Button } from './Button';

interface ErrorStateProps {
	title?: string;
	message: string;
	code?: string;
	onRetry?: () => void;
	/** A way to fix the cause (e.g. "Select interpreter"), shown beside Retry. */
	action?: ReactNode;
	className?: string;
}

export function ErrorState({
	title = 'Something went wrong',
	message,
	code,
	onRetry,
	action,
	className,
}: ErrorStateProps): JSX.Element {
	return (
		<div
			role='alert'
			className={cn(
				'flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center',
				className,
			)}
		>
			<TriangleAlert size={20} className='text-down' />
			<p className='text-14 font-medium text-fg-0'>{title}</p>
			<p className='selectable max-w-96 text-12 text-fg-1'>{message}</p>
			{code && <code className='text-11 text-fg-2'>{code}</code>}
			{(onRetry || action) && (
				<div className='mt-2 flex items-center gap-2'>
					{action}
					{onRetry && (
						<Button size='sm' onClick={onRetry}>
							Retry
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
