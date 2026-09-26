import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { CopyValue } from './CopyValue';

interface ResultRowProps {
	label: string;
	value: string;
	display?: ReactNode;
	mono?: boolean;
	highlight?: boolean;
}

export function ResultRow({
	label,
	value,
	display,
	mono = true,
	highlight = false,
}: ResultRowProps): JSX.Element {
	return (
		<div
			className={cn(
				'flex min-w-0 items-center gap-2 rounded-sm pl-1.5',
				highlight && 'bg-accent-faint',
			)}
		>
			<span
				className={cn(
					'w-24 shrink-0 truncate text-11',
					highlight ? 'text-accent' : 'text-fg-2',
				)}
				title={label}
			>
				{label}
			</span>
			<CopyValue value={value} display={display} label={label} mono={mono} />
		</div>
	);
}
