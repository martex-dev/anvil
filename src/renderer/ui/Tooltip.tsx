import { Tooltip as RadixTooltip } from 'radix-ui';
import type { JSX, ReactNode } from 'react';

import { Kbd } from './Kbd';

interface TooltipProps {
	content: ReactNode;
	shortcut?: string | undefined;
	side?: 'top' | 'right' | 'bottom' | 'left';
	children: ReactNode;
}

export function TooltipProvider({ children }: { children: ReactNode }): JSX.Element {
	return (
		<RadixTooltip.Provider delayDuration={400} skipDelayDuration={200}>
			{children}
		</RadixTooltip.Provider>
	);
}

export function Tooltip({
	content,
	shortcut,
	side = 'bottom',
	children,
}: TooltipProps): JSX.Element {
	return (
		<RadixTooltip.Root>
			<RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
			<RadixTooltip.Portal>
				<RadixTooltip.Content
					side={side}
					sideOffset={6}
					className='glass-strong animate-fade z-50 flex items-center gap-2 rounded-md px-2 py-1 text-12 text-fg-0'
				>
					{content}
					{shortcut && <Kbd keys={shortcut} />}
				</RadixTooltip.Content>
			</RadixTooltip.Portal>
		</RadixTooltip.Root>
	);
}
