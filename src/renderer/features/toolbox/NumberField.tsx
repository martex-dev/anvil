import type { JSX } from 'react';

import { Input } from '../../ui/Input';
import { Field } from './Field';

interface NumberFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function NumberField({
	label,
	value,
	onChange,
	placeholder,
}: NumberFieldProps): JSX.Element {
	return (
		<Field label={label} className='min-w-28 flex-1'>
			<Input
				aria-label={label}
				inputMode='decimal'
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className='num'
				spellCheck={false}
			/>
		</Field>
	);
}
