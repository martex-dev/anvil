import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { Tooltip } from '../../ui/Tooltip';

/** One Midnight-Commander style key cap: the number in reverse video, then the action word. */
export function FKey({
	n,
	word,
	label,
	shortcut,
	armed,
	onClick,
}: {
	n: number;
	word: string;
	label: string;
	shortcut?: string | undefined;
	armed?: boolean;
	onClick: () => void;
}): JSX.Element {
	return (
		<Tooltip content={label} shortcut={shortcut} side='top'>
			<button
				type='button'
				aria-label={label}
				data-part='fkey'
				data-armed={armed || undefined}
				onClick={onClick}
				className={cn('mf-fkey', armed && 'mf-fkey-armed')}
			>
				<span className='mf-fkey-n'>{n}</span>
				<span className='mf-fkey-word'>{word}</span>
			</button>
		</Tooltip>
	);
}
