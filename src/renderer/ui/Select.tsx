import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import { type JSX, useState } from 'react';

import { cn } from '@renderer/lib/cn';
import { useRegisterOverlay } from '@renderer/stores/overlay-store';

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
	/** Renders the label in this CSS font-family (a font picker previews each font). */
	fontFamily?: string;
}

interface SelectProps {
	value: string;
	onValueChange: (value: string) => void;
	options: SelectOption[];
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	'aria-label'?: string;
}

export function Select({
	value,
	onValueChange,
	options,
	placeholder,
	disabled,
	className,
	'aria-label': ariaLabel,
}: SelectProps): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);

	return (
		<RadixSelect.Root
			value={value}
			onValueChange={onValueChange}
			open={open}
			onOpenChange={setOpen}
			disabled={disabled ?? false}
		>
			<RadixSelect.Trigger
				aria-label={ariaLabel}
				className={cn(
					'inline-flex h-7 min-w-32 items-center justify-between gap-2 rounded-md border border-border-strong bg-bg-2/70 px-2 text-13 text-fg-0',
					'hover:border-border-strong focus-visible:border-accent focus-visible:shadow-glow focus-visible:outline-none',
					'disabled:opacity-40 data-[placeholder]:text-fg-2',
					className,
				)}
			>
				<RadixSelect.Value placeholder={placeholder} />
				<RadixSelect.Icon>
					<ChevronDown size={14} className='text-fg-2' />
				</RadixSelect.Icon>
			</RadixSelect.Trigger>
			<RadixSelect.Portal>
				<RadixSelect.Content
					position='popper'
					sideOffset={4}
					className='glass-strong animate-in z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md p-1'
				>
					<RadixSelect.Viewport>
						{options.map((opt) => (
							<RadixSelect.Item
								key={opt.value}
								value={opt.value}
								disabled={opt.disabled ?? false}
								className={cn(
									'relative flex h-7 cursor-default items-center rounded-sm pr-2 pl-6 text-13 text-fg-1 outline-none',
									'data-[highlighted]:bg-accent-faint data-[highlighted]:text-fg-0 data-[disabled]:opacity-40',
								)}
							>
								<RadixSelect.ItemIndicator className='absolute left-1.5 text-accent'>
									<Check size={12} />
								</RadixSelect.ItemIndicator>
								<RadixSelect.ItemText>
									{/* Inside ItemText so the trigger's copy keeps the face too. */}
									<span
										style={
											opt.fontFamily
												? { fontFamily: opt.fontFamily }
												: undefined
										}
									>
										{opt.label}
									</span>
								</RadixSelect.ItemText>
							</RadixSelect.Item>
						))}
					</RadixSelect.Viewport>
				</RadixSelect.Content>
			</RadixSelect.Portal>
		</RadixSelect.Root>
	);
}
