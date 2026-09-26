import { TriangleAlert } from 'lucide-react';
import type { JSX } from 'react';

export function ToolError({ message }: { message: string }): JSX.Element {
	return (
		<p aria-live='polite' className='selectable flex items-start gap-1.5 text-12 text-down'>
			<TriangleAlert size={12} className='mt-0.5 shrink-0' aria-hidden />
			<span className='min-w-0 break-words'>{message}</span>
		</p>
	);
}
