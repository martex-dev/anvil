import type { JSX } from 'react';

import { cn } from '../../lib/cn';

export function SettingSegmented<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: readonly T[];
	onChange: (v: T) => void;
}): JSX.Element {
	return (
		<div
			role='radiogroup'
			className='flex overflow-hidden rounded-md border border-border-strong'
		>
			{options.map((o) => (
				<button
					key={o}
					type='button'
					role='radio'
					aria-checked={o === value}
					onClick={() => onChange(o)}
					className={cn(
						'px-2.5 py-1 text-12 capitalize',
						o === value ? 'bg-accent-soft text-fg-0' : 'text-fg-2 hover:text-fg-1',
					)}
				>
					{o}
				</button>
			))}
		</div>
	);
}
