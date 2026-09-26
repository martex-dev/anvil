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
	return (
		<SettingRow label={label} description={description}>
			<div className='flex items-center gap-1'>
				<Button
					size='sm'
					variant='ghost'
					disabled={value <= min}
					onClick={() => onChange(value - 1)}
					aria-label={`Decrease ${label}`}
				>
					−
				</Button>
				<span className='num w-8 text-center text-13 text-fg-0'>{value}</span>
				<Button
					size='sm'
					variant='ghost'
					disabled={value >= max}
					onClick={() => onChange(value + 1)}
					aria-label={`Increase ${label}`}
				>
					+
				</Button>
			</div>
		</SettingRow>
	);
}
