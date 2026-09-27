import { FileCode2, Minus, Plus, Undo2 } from 'lucide-react';
import type { JSX } from 'react';

import type { GitChange, GitChangeKind } from '@shared/ipc/channels/git';

import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';

const BADGE: Record<GitChangeKind, { letter: string; className: string; label: string }> = {
	modified: { letter: 'M', className: 'text-warn', label: 'Modified' },
	added: { letter: 'A', className: 'text-up', label: 'Added' },
	untracked: { letter: 'U', className: 'text-up', label: 'Untracked' },
	deleted: { letter: 'D', className: 'text-down', label: 'Deleted' },
	renamed: { letter: 'R', className: 'text-info', label: 'Renamed' },
	conflicted: { letter: '!', className: 'text-down', label: 'Conflict' },
};

interface ChangeRowProps {
	change: GitChange;
	staged: boolean;
	busy: boolean;
	onOpen: () => void;
	onToggle: () => void;
	/** Unstaged rows only; conflicted files have nothing to discard to. */
	onDiscard?: (() => void) | undefined;
}

/** One file in a change list: open its diff, (un)stage it, discard it. */
export function ChangeRow({
	change,
	staged,
	busy,
	onOpen,
	onToggle,
	onDiscard,
}: ChangeRowProps): JSX.Element {
	const badge = BADGE[change.kind];
	const name = change.path.split('/').at(-1) ?? change.path;
	const dir = change.path.slice(0, -name.length - 1);
	const actionLabel = staged ? 'Unstage' : 'Stage';
	const ActionIcon = staged ? Minus : Plus;
	const hover = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100';
	return (
		<li
			className='group flex h-6 cursor-default items-center gap-1.5 pr-1 pl-5 text-12 hover:bg-bg-2'
			title={`${change.path} — ${badge.label}${change.from ? ` (from ${change.from})` : ''}`}
		>
			<button
				type='button'
				onClick={onOpen}
				className='flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none focus-visible:text-fg-0 focus-visible:shadow-glow'
			>
				<FileCode2 size={13} className='shrink-0 text-fg-2' />
				<span
					className={cn(
						'truncate text-fg-0',
						change.kind === 'deleted' && 'line-through opacity-70',
					)}
				>
					{name}
				</span>
				{dir && <span className='truncate text-11 text-fg-2'>{dir}</span>}
				{/* The badge letter is aria-hidden (aria-label is ignored on a plain span); the
				status is spoken with the file name instead. */}
				<span className='sr-only'>, {badge.label}</span>
			</button>
			{onDiscard && (
				<IconButton
					size='sm'
					label={
						change.kind === 'untracked'
							? `Delete ${name}`
							: `Discard changes in ${name}`
					}
					icon={<Undo2 size={12} />}
					disabled={busy}
					className={hover}
					onClick={onDiscard}
				/>
			)}
			<IconButton
				size='sm'
				label={`${actionLabel} ${name}`}
				icon={<ActionIcon size={12} />}
				disabled={busy}
				className={hover}
				data-toggle
				onClick={onToggle}
			/>
			<span
				aria-hidden
				className={cn('num w-3 text-center text-11 font-semibold', badge.className)}
			>
				{badge.letter}
			</span>
		</li>
	);
}
