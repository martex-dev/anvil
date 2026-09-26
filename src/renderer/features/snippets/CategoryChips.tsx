import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { SNIPPET_CATEGORIES, type SnippetCategory } from './library';

interface CategoryChipsProps {
	value: SnippetCategory | null;
	onChange: (value: SnippetCategory | null) => void;
	/** Matches per category for the current search; a category with none is dimmed. */
	counts: ReadonlyMap<SnippetCategory, number>;
	total: number;
}

function Chip({
	label,
	count,
	active,
	onClick,
}: {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
}): JSX.Element {
	return (
		<button
			type='button'
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				'inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-11',
				'transition-[background-color,border-color,color] transition-fast',
				'focus-visible:shadow-glow focus-visible:outline-none',
				active
					? 'border-accent/40 bg-accent-soft text-accent'
					: 'border-border text-fg-1 hover:border-border-strong hover:text-fg-0',
				!active && count === 0 && 'opacity-50',
			)}
		>
			{label}
			<span className={cn('num text-10', active ? 'text-accent' : 'text-fg-2')}>{count}</span>
		</button>
	);
}

export function CategoryChips({ value, onChange, counts, total }: CategoryChipsProps): JSX.Element {
	return (
		<div role='group' aria-label='Filter by category' className='flex flex-wrap gap-1'>
			<Chip
				label='All'
				count={total}
				active={value === null}
				onClick={() => onChange(null)}
			/>
			{SNIPPET_CATEGORIES.map((category) => (
				<Chip
					key={category}
					label={category}
					count={counts.get(category) ?? 0}
					active={value === category}
					onClick={() => onChange(value === category ? null : category)}
				/>
			))}
		</div>
	);
}
