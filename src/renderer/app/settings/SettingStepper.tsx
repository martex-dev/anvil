import type { JSX } from 'react';

import { Button } from '../../ui/Button';
import { SettingRow } from './SettingRow';

export function SettingStepper({
	label,
	description,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	description?: string;
	value: number;
	min: number;
	max: number;
	onChange: (v: number) => void;
}): JSX.Element {
	// aria-disabled, not disabled: a focused button that became disabled at the limit would drop
	// keyboard focus to the page.
	const step = (delta: number, blocked: boolean) => ({
		'aria-disabled': blocked || undefined,
		onClick: () => {
			if (!blocked) onChange(value + delta);
		},
		className: blocked ? 'opacity-40 cursor-default hover:bg-transparent hover:text-fg-1' : '',
	});
	return (
		<SettingRow label={label} description={description}>
			<div className='flex items-center gap-1'>
				<Button
					size='sm'
					variant='ghost'
					{...step(-1, value <= min)}
					aria-label={`Decrease ${label}`}
				>
					−
				</Button>
				<span aria-live='polite' className='num w-8 text-center text-13 text-fg-0'>
					{value}
				</span>
				<Button
					size='sm'
					variant='ghost'
					{...step(1, value >= max)}
					aria-label={`Increase ${label}`}
				>
					+
				</Button>
			</div>
		</SettingRow>
	);
}
