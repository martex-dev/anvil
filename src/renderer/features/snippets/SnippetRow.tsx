import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { snippetOptionId } from './group';
import type { Snippet } from './library';

const LANG_LABELS: Record<Snippet['language'], string> = {
	python: 'py',
	typescript: 'ts',
};

interface SnippetRowProps {
	snippet: Snippet;
	selected: boolean;
	onSelect: () => void;
	onInsert: () => void;
}

export function SnippetRow({
	snippet,
	selected,
	onSelect,
	onInsert,
}: SnippetRowProps): JSX.Element {
	return (
		<div
			role='option'
			id={snippetOptionId(snippet)}
			aria-selected={selected}
			onClick={onSelect}
			onDoubleClick={onInsert}
			className={cn(
				'relative flex cursor-default flex-col gap-0.5 rounded-sm px-2 py-1',
				'transition-[background-color] transition-fast',
				selected ? 'bg-accent-soft' : 'hover:bg-bg-3',
			)}
		>
			{selected && (
				<span
					aria-hidden
					className='accent-line absolute inset-y-1 left-0 w-0.5 rounded-full'
				/>
			)}
			<div className='flex min-w-0 items-center gap-1.5'>
				<span
					className={cn(
						'min-w-0 flex-1 truncate text-12',
						selected ? 'text-fg-0' : 'text-fg-1',
					)}
					title={snippet.name}
				>
					{snippet.name}
				</span>
				<code className='shrink-0 rounded-sm border border-border bg-bg-2 px-1 text-11 text-accent'>
					{snippet.prefix}
				</code>
				<span className='num w-4 shrink-0 text-right text-10 text-fg-2 uppercase'>
					{LANG_LABELS[snippet.language]}
				</span>
			</div>
			<p className='truncate text-11 text-fg-2' title={snippet.description}>
				{snippet.description}
			</p>
		</div>
	);
}
