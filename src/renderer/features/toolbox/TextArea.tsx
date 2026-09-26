import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const TextArea = forwardRef<
	HTMLTextAreaElement,
	TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, rows = 4, ...rest }, ref) {
	return (
		<textarea
			ref={ref}
			rows={rows}
			spellCheck={false}
			className={cn(
				'num w-full resize-y rounded-sm border border-border bg-bg-2 px-2 py-1.5 text-12 text-fg-0',
				'transition-[border-color,box-shadow] transition-fast placeholder:text-fg-2',
				'hover:border-border-strong focus:border-accent focus:shadow-glow focus:outline-none',
				className,
			)}
			{...rest}
		/>
	);
});
