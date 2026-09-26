import { type JSX, useMemo } from 'react';

import { cn } from '../../lib/cn';
import { renderPlaceholders } from './placeholders';

/** A snippet body with its tab stops drawn as chips, so you can see what you'll fill in. */
export function SnippetBody({ body }: { body: string }): JSX.Element {
	const segments = useMemo(() => renderPlaceholders(body), [body]);
	return (
		<pre className='selectable num m-0 text-12 leading-relaxed whitespace-pre text-fg-1'>
			{segments.map((seg, i) => {
				if (seg.kind === 'text') return <span key={i}>{seg.text}</span>;
				const empty = seg.text === '';
				const title = seg.choices
					? `Tab stop ${seg.index}: one of ${seg.choices.join(', ')}`
					: seg.index === 0
						? 'Final cursor position'
						: `Tab stop ${seg.index}`;
				return (
					<span
						key={i}
						title={title}
						className={cn(
							'rounded-sm px-0.5',
							seg.choices
								? 'bg-accent-faint text-accent-2 underline decoration-dotted underline-offset-2'
								: 'bg-accent-soft text-accent',
							empty && 'text-10 opacity-70',
						)}
					>
						{empty ? `$${seg.index}` : seg.text}
					</span>
				);
			})}
		</pre>
	);
}
