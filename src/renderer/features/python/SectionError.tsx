import { TriangleAlert } from 'lucide-react';
import type { JSX } from 'react';

import { Button } from '../../ui/Button';

/** Compact error state for a Run view section (ErrorState is sized for a whole view). */
export function SectionError({
	title,
	message,
	onRetry,
}: {
	title: string;
	message: string;
	onRetry: () => void;
}): JSX.Element {
	return (
		<div role='alert' className='flex flex-col items-start gap-1.5 text-12'>
			<p className='flex items-center gap-1.5 font-medium text-fg-0'>
				<TriangleAlert size={12} className='shrink-0 text-down' />
				{title}
			</p>
			<p className='selectable break-words text-fg-2'>{message}</p>
			<Button size='sm' onClick={onRetry}>
				Retry
			</Button>
		</div>
	);
}
