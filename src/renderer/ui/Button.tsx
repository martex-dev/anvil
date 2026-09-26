import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
	primary:
		'accent-gradient text-on-accent font-semibold shadow-glow-soft hover:brightness-110 hover:shadow-glow',
	secondary:
		'bg-bg-2/70 text-fg-0 border border-border-strong hover:bg-bg-3 hover:border-accent/40',
	ghost: 'bg-transparent text-fg-1 hover:bg-bg-3 hover:text-fg-0',
	danger: 'bg-down-soft text-down border border-down/40 hover:bg-down hover:text-fg-0',
};

const sizes: Record<ButtonSize, string> = {
	sm: 'h-6 px-2 text-12 gap-1',
	md: 'h-7 px-3 text-13 gap-1.5',
	lg: 'h-8 px-4 text-14 gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		variant = 'secondary',
		size = 'md',
		loading = false,
		icon,
		className,
		children,
		disabled,
		...rest
	},
	ref,
) {
	return (
		<button
			ref={ref}
			type='button'
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			className={cn(
				'inline-flex items-center justify-center rounded-md whitespace-nowrap select-none',
				'transition-[background-color,border-color,color,filter] transition-fast',
				'focus-visible:shadow-glow focus-visible:outline-none',
				'disabled:pointer-events-none disabled:opacity-40',
				variants[variant],
				sizes[size],
				className,
			)}
			{...rest}
		>
			{loading ? <Spinner size={12} /> : icon}
			{children}
		</button>
	);
});
