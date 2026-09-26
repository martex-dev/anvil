import { TriangleAlert } from 'lucide-react';
import type { JSX } from 'react';

export function ToolError({ message }: { message: string }): JSX.Element {
	// Mounted together with its text, so a plain aria-live region would usually stay silent;
	// role='alert' is announced on insertion as well as on change.
	return (
		<p role='alert' className='selectable flex items-start gap-1.5 text-12 text-down'>
			<TriangleAlert size={12} className='mt-0.5 shrink-0' aria-hidden />
			<span className='min-w-0 break-words'>{message}</span>
		</p>
	);
}
