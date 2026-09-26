import type { JSX } from 'react';

import { cn } from '@renderer/lib/cn';

interface KbdProps {
	/** Shortcut such as "Ctrl+K" or "Ctrl+Shift+P"; split into individual keys. */
	keys: string;
	className?: string;
}

export function Kbd({ keys, className }: KbdProps): JSX.Element {
	return (
		<span className={cn('inline-flex items-center gap-0.5', className)}>
			{keys.split('+').map((key) => (
				<kbd
					key={key}
					className='inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border-strong border-b-2 bg-bg-2/80 px-1 font-mono text-10 text-fg-1'
				>
					{key}
				</kbd>
			))}
		</span>
	);
}
