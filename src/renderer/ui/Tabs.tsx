import { Tabs as RadixTabs } from 'radix-ui';
import type { JSX, ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

export interface TabItem {
	value: string;
	label: ReactNode;
	content: ReactNode;
	disabled?: boolean;
}

interface TabsProps {
	items: TabItem[];
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	orientation?: 'horizontal' | 'vertical';
	className?: string;
	'aria-label'?: string;
}

export function Tabs({
	items,
	value,
	defaultValue,
	onValueChange,
	orientation = 'horizontal',
	className,
	'aria-label': ariaLabel,
}: TabsProps): JSX.Element {
	const vertical = orientation === 'vertical';
	return (
		<RadixTabs.Root
			{...(value !== undefined ? { value } : {})}
			defaultValue={defaultValue ?? items[0]?.value}
			{...(onValueChange ? { onValueChange } : {})}
			orientation={orientation}
			className={cn('flex min-h-0', vertical ? 'flex-row' : 'flex-col', className)}
		>
			<RadixTabs.List
				aria-label={ariaLabel}
				className={cn(
					'flex shrink-0',
					vertical
						? 'w-44 flex-col gap-0.5 border-r border-border p-2'
						: 'h-8 gap-1 border-b border-border px-2',
				)}
			>
				{items.map((item) => (
					<RadixTabs.Trigger
						key={item.value}
						value={item.value}
						disabled={item.disabled ?? false}
						className={cn(
							'relative flex items-center gap-1.5 text-13 text-fg-2 outline-none transition-colors transition-fast',
							'hover:text-fg-0 focus-visible:text-fg-0 data-[state=active]:text-fg-0 disabled:opacity-40',
							vertical
								? 'h-7 rounded-sm px-2 data-[state=active]:bg-bg-3 focus-visible:shadow-glow'
								: 'px-2 after:absolute after:inset-x-1 after:-bottom-px after:h-px data-[state=active]:after:bg-accent focus-visible:bg-bg-3',
						)}
					>
						{item.label}
					</RadixTabs.Trigger>
				))}
			</RadixTabs.List>
			{items.map((item) => (
				<RadixTabs.Content
					key={item.value}
					value={item.value}
					className='min-h-0 flex-1 overflow-auto outline-none'
				>
					{item.content}
				</RadixTabs.Content>
			))}
		</RadixTabs.Root>
	);
}
