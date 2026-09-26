import type { JSX, ReactNode } from 'react';

import { cn } from '@renderer/lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'up' | 'down' | 'warn' | 'info';

const tones: Record<BadgeTone, string> = {
	neutral: 'bg-bg-3 text-fg-1 border-border',
	accent: 'bg-accent-soft text-accent border-accent/30',
	up: 'bg-up-soft text-up border-up/30',
	down: 'bg-down-soft text-down border-down/30',
	warn: 'bg-warn-soft text-warn border-warn/30',
	info: 'bg-info-soft text-info border-info/30',
};

interface BadgeProps {
	tone?: BadgeTone;
	children: ReactNode;
	className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps): JSX.Element {
	return (
		<span
			className={cn(
				'inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-11 font-medium whitespace-nowrap',
				tones[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}
