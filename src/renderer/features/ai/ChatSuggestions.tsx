import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { FileBadge } from '../../ui/FileBadge';
import { Spinner } from '../../ui/Spinner';
import type { SuggestionStatus } from './chat-shortcuts';

export interface ChatSuggestion {
	id: string;
	label: string;
	hint: string;
}

/** Id of an option, for the composer's aria-activedescendant. */
export function suggestionOptionId(listId: string, index: number): string {
	return `${listId}-option-${index}`;
}

/**
 * The `@` file / `/` command popup above the composer. Focus stays in the textarea (a combobox),
 * so options are plain elements picked with the arrow keys or the mouse.
 */
export function ChatSuggestions({
	listId,
	kind,
	suggestions,
	pick,
	status,
	onChoose,
}: {
	listId: string;
	kind: '@' | '/';
	suggestions: ChatSuggestion[];
	pick: number;
	status: SuggestionStatus | null;
	onChoose: (index: number) => void;
}): JSX.Element {
	return (
		<div className='glass-strong animate-in absolute right-0 bottom-full left-0 z-20 mb-1 max-h-60 overflow-auto p-1'>
			{suggestions.length > 0 ? (
				<ul id={listId} role='listbox' aria-label={kind === '@' ? 'Files' : 'Commands'}>
					{suggestions.map((s, i) => (
						<li
							key={s.id}
							id={suggestionOptionId(listId, i)}
							role='option'
							aria-selected={i === pick}
							onMouseDown={(e) => {
								// Keep focus (and the caret) in the textarea.
								e.preventDefault();
								onChoose(i);
							}}
							className={cn(
								'flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-12',
								i === pick
									? 'bg-accent-faint text-fg-0'
									: 'text-fg-1 hover:bg-bg-3',
							)}
						>
							{kind === '@' ? (
								<>
									<FileBadge name={s.label} />
									<span>{s.label}</span>
								</>
							) : (
								<span className='font-mono text-accent'>{s.label}</span>
							)}
							<span className='truncate text-11 text-fg-2'>{s.hint}</span>
						</li>
					))}
				</ul>
			) : (
				status && (
					<p
						role='status'
						className={cn(
							'flex h-7 items-center gap-2 px-2 text-12',
							status.tone === 'error' ? 'text-down' : 'text-fg-2',
						)}
					>
						{status.tone === 'loading' && <Spinner size={12} label='Loading files' />}
						<span className='truncate'>{status.text}</span>
					</p>
				)
			)}
		</div>
	);
}
