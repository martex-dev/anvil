import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import type { JSX } from 'react';

import { cn } from '@renderer/lib/cn';
import { type ToastTone, useToastStore } from '@renderer/stores/toast-store';

const toneStyle: Record<ToastTone, { icon: JSX.Element; bar: string }> = {
	info: { icon: <Info size={14} className='text-info' />, bar: 'bg-info' },
	success: { icon: <CircleCheck size={14} className='text-up' />, bar: 'bg-up' },
	warn: { icon: <TriangleAlert size={14} className='text-warn' />, bar: 'bg-warn' },
	error: { icon: <CircleAlert size={14} className='text-down' />, bar: 'bg-down' },
};

/** Mount once at the app root; raise toasts with `toast.*()` from the toast store. */
export function Toaster(): JSX.Element {
	const toasts = useToastStore((s) => s.toasts);
	const dismiss = useToastStore((s) => s.dismiss);

	return (
		<RadixToast.Provider swipeDirection='right'>
			{toasts.map((t) => (
				<RadixToast.Root
					key={t.id}
					open={t.open}
					duration={t.durationMs}
					onOpenChange={(open) => {
						if (!open) dismiss(t.id);
					}}
					className='glass-strong animate-in toast-swipe relative flex w-80 items-start gap-2 overflow-hidden rounded-lg py-2 pr-2 pl-3'
				>
					<span
						className={cn('absolute inset-y-0 left-0 w-0.5', toneStyle[t.tone].bar)}
					/>
					<span className='mt-0.5'>{toneStyle[t.tone].icon}</span>
					<div className='min-w-0 flex-1'>
						<RadixToast.Title className='text-13 font-medium wrap-anywhere text-fg-0'>
							{t.title}
							{t.count > 1 && (
								<span className='num ml-1.5 text-11 text-fg-2'>×{t.count}</span>
							)}
						</RadixToast.Title>
						{t.description && (
							<RadixToast.Description className='selectable mt-0.5 max-h-40 overflow-auto text-12 wrap-anywhere text-fg-1'>
								{t.description}
							</RadixToast.Description>
						)}
					</div>
					<RadixToast.Close
						aria-label='Dismiss'
						className='rounded-sm p-0.5 text-fg-2 hover:bg-bg-3 hover:text-fg-0'
					>
						<X size={12} />
					</RadixToast.Close>
				</RadixToast.Root>
			))}
			<RadixToast.Viewport className='fixed right-3 bottom-9 z-[60] flex flex-col gap-2 outline-none' />
		</RadixToast.Provider>
	);
}
