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
				// Matches ui/Input and ui/Select, which sit beside it in the same forms.
				'num w-full resize-y rounded-md border border-border-strong bg-bg-2/70 px-2 py-1.5 text-13 text-fg-0',
				'transition-[border-color,box-shadow] transition-fast placeholder:text-fg-2',
				'hover:border-accent/40 focus:border-accent focus:shadow-glow focus:outline-none',
				className,
			)}
			{...rest}
		/>
	);
});
