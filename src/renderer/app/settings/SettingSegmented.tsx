import type { JSX, KeyboardEvent } from 'react';

import { cn } from '../../lib/cn';
import { rovingIndex } from '../../lib/roving';

/** A radio group drawn as a segmented control: arrows move and select, Tab enters and leaves. */
export function SettingSegmented<T extends string>({
	value,
	options,
	onChange,
	'aria-label': ariaLabel,
}: {
	value: T;
	options: readonly T[];
	onChange: (v: T) => void;
	'aria-label': string;
}): JSX.Element {
	// Roving tabIndex: only the checked option (or the first, if none is) is in the Tab order.
	const tabStop = Math.max(0, options.indexOf(value));
	const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
		const next = rovingIndex(e.key, index, options.length);
		const option = next === null ? undefined : options[next];
		if (next === null || option === undefined) return;
		e.preventDefault();
		onChange(option);
		e.currentTarget.parentElement
			?.querySelectorAll<HTMLElement>('[role="radio"]')
			[next]?.focus();
	};
	return (
		<div
			role='radiogroup'
			aria-label={ariaLabel}
			className='flex overflow-hidden rounded-md border border-border-strong'
		>
			{options.map((o, i) => (
				<button
					key={o}
					type='button'
					role='radio'
					aria-checked={o === value}
					tabIndex={i === tabStop ? 0 : -1}
					onClick={() => onChange(o)}
					onKeyDown={(e) => onKeyDown(e, i)}
					className={cn(
						// Inset ring: the group clips anything drawn outside the buttons.
						'px-2.5 py-1 text-12 capitalize transition-colors transition-fast focus-visible:outline-offset-[-2px]',
						o === value ? 'bg-accent-soft text-fg-0' : 'text-fg-2 hover:text-fg-1',
					)}
				>
					{o}
				</button>
			))}
		</div>
	);
}
