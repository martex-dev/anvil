import { Switch as RadixSwitch } from 'radix-ui';
import type { JSX } from 'react';

import { cn } from '@renderer/lib/cn';

interface SwitchProps {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	'aria-label'?: string;
	id?: string;
}

export function Switch({
	checked,
	onCheckedChange,
	disabled,
	id,
	...rest
}: SwitchProps): JSX.Element {
	return (
		<RadixSwitch.Root
			id={id}
			checked={checked}
			onCheckedChange={onCheckedChange}
			disabled={disabled ?? false}
			aria-label={rest['aria-label']}
			className={cn(
				'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors transition-fast',
				'focus-visible:shadow-glow focus-visible:outline-none disabled:opacity-40',
				'data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft',
				'data-[state=unchecked]:border-border-strong data-[state=unchecked]:bg-bg-2',
			)}
		>
			<RadixSwitch.Thumb
				className={cn(
					'block size-2.5 rounded-full transition-transform transition-fast',
					'data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-accent',
					'data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-fg-2',
				)}
			/>
		</RadixSwitch.Root>
	);
}
