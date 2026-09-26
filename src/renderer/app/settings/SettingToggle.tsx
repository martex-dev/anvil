import type { JSX, ReactNode } from 'react';

import { Switch } from '../../ui/Switch';
import { SettingRow } from './SettingRow';

export function SettingToggle({
	label,
	description,
	value,
	onChange,
}: {
	label: string;
	description?: ReactNode;
	value: boolean;
	onChange: (v: boolean) => void;
}): JSX.Element {
	const id = `set-${label.replace(/\W+/g, '-').toLowerCase()}`;
	return (
		<SettingRow label={label} description={description} htmlFor={id}>
			<Switch id={id} aria-label={label} checked={value} onCheckedChange={onChange} />
		</SettingRow>
	);
}
