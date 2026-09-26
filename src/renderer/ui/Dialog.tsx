import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { JSX, ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';
import { useRegisterOverlay } from '@renderer/stores/overlay-store';

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: ReactNode;
	children?: ReactNode;
	footer?: ReactNode;
	width?: 'sm' | 'md' | 'lg';
}

const widths = { sm: 'w-96', md: 'w-[32rem]', lg: 'w-[48rem]' } as const;

export function Dialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	width = 'md',
}: DialogProps): JSX.Element {
	useRegisterOverlay(open);

	return (
		<RadixDialog.Root open={open} onOpenChange={onOpenChange}>
			<RadixDialog.Portal>
				<RadixDialog.Overlay className='animate-fade fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]' />
				<RadixDialog.Content
					className={cn(
						'fixed top-1/2 left-1/2 z-50 max-h-[85vh] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
						'glass-strong animate-in flex flex-col rounded-xl outline-none',
						widths[width],
					)}
				>
					<div className='flex items-start gap-3 border-b border-glass-edge px-4 py-3'>
						<div className='min-w-0 flex-1'>
							<RadixDialog.Title className='text-14 font-semibold text-fg-0'>
								{title}
							</RadixDialog.Title>
							{description ? (
								<RadixDialog.Description className='mt-1 text-12 text-fg-2'>
									{description}
								</RadixDialog.Description>
							) : (
								<RadixDialog.Description className='sr-only'>
									{title}
								</RadixDialog.Description>
							)}
						</div>
						<RadixDialog.Close
							aria-label='Close'
							className='rounded-sm p-1 text-fg-2 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
						>
							<X size={14} />
						</RadixDialog.Close>
					</div>
					{children && (
						<div className='min-h-0 flex-1 overflow-auto px-4 py-3'>{children}</div>
					)}
					{footer && (
						<div className='flex justify-end gap-2 border-t border-glass-edge px-4 py-3'>
							{footer}
						</div>
					)}
				</RadixDialog.Content>
			</RadixDialog.Portal>
		</RadixDialog.Root>
	);
}
