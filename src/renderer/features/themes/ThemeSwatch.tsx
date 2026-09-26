import type { JSX } from 'react';

import { cn } from '../../lib/cn';

/**
 * A theme in miniature: its panel color with the accent and three syntax colors. The
 * data-theme attribute re-scopes every token inside, so it shows that theme, not the app's.
 */
export function ThemeSwatch({ id, className }: { id: string; className?: string }): JSX.Element {
	return (
		<span
			data-theme={id}
			aria-hidden
			className={cn(
				'inline-flex h-4 w-7 shrink-0 items-center gap-[2px] rounded-sm border border-border-strong bg-bg-1 px-[3px]',
				className,
			)}
		>
			<span className='h-2.5 w-1 rounded-full bg-accent' />
			<span className='h-1.5 w-1 rounded-full' style={{ background: 'var(--syn-keyword)' }} />
			<span className='h-1.5 w-1 rounded-full' style={{ background: 'var(--syn-string)' }} />
			<span
				className='h-1.5 w-1 rounded-full'
				style={{ background: 'var(--syn-function)' }}
			/>
		</span>
	);
}
