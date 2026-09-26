import type { JSX } from 'react';

import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string> {
	value: T;
	label: string;
}

interface SegmentedProps<T extends string> {
	options: readonly SegmentedOption<T>[];
	/** null renders every segment unpressed (no mode chosen yet). */
	value: T | null;
	onChange: (value: T) => void;
	'aria-label': string;
	className?: string;
}

export function Segmented<T extends string>({
	options,
	value,
	onChange,
	'aria-label': ariaLabel,
	className,
}: SegmentedProps<T>): JSX.Element {
	return (
		<div
			role='group'
			aria-label={ariaLabel}
			className={cn('flex h-7 rounded-sm border border-border bg-bg-2 p-0.5', className)}
		>
			{options.map((opt) => {
				const active = opt.value === value;
				return (
					<button
						key={opt.value}
						type='button'
						aria-pressed={active}
						onClick={() => onChange(opt.value)}
						className={cn(
							'min-w-0 flex-1 truncate rounded-sm px-2 text-12',
							'transition-[background-color,color] transition-fast',
							'focus-visible:shadow-glow focus-visible:outline-none',
							active
								? 'bg-accent-soft text-accent'
								: 'text-fg-1 hover:bg-bg-3 hover:text-fg-0',
						)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
