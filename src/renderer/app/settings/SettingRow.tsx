import type { JSX, ReactNode } from 'react';

interface SettingRowProps {
	label: string;
	description?: ReactNode;
	htmlFor?: string;
	children: ReactNode;
}

export function SettingRow({
	label,
	description,
	htmlFor,
	children,
}: SettingRowProps): JSX.Element {
	return (
		<div className='flex items-center gap-4 py-3'>
			<div className='min-w-0 flex-1'>
				<label htmlFor={htmlFor} className='text-13 font-medium text-fg-0'>
					{label}
				</label>
				{description && <p className='text-12 text-fg-2'>{description}</p>}
			</div>
			<div className='shrink-0'>{children}</div>
		</div>
	);
}
