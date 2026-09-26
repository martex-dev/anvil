import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	leading?: ReactNode;
	invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ leading, invalid = false, className, ...rest },
	ref,
) {
	return (
		<div
			className={cn(
				'flex h-7 items-center gap-2 rounded-md border bg-bg-2/70 px-2 text-13',
				'transition-[border-color,box-shadow] transition-fast',
				'focus-within:border-accent focus-within:shadow-glow',
				invalid ? 'border-down' : 'border-border-strong hover:border-accent/40',
				rest.disabled && 'opacity-40',
				className,
			)}
		>
			{leading && <span className='text-fg-2'>{leading}</span>}
			<input
				ref={ref}
				aria-invalid={invalid || undefined}
				className='h-full min-w-0 flex-1 bg-transparent text-fg-0 outline-none placeholder:text-fg-2 focus-visible:outline-none'
				{...rest}
			/>
		</div>
	);
});
