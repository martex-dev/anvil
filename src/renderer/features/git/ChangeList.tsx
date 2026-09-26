import { ChevronDown, FileCode2, Minus, Plus } from 'lucide-react';
import { type JSX, useState } from 'react';

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

interface ChangeListProps {
	title: string;
	changes: GitChange[];
	staged: boolean;
	onOpen: (change: GitChange) => void;
	onToggle: (paths: string[]) => void;
	busy: boolean;
}

export function ChangeList({
	title,
	changes,
	staged,
	onOpen,
	onToggle,
	busy,
}: ChangeListProps): JSX.Element | null {
	const [collapsed, setCollapsed] = useState(false);
	if (changes.length === 0) return null;
	const actionLabel = staged ? 'Unstage' : 'Stage';
	const ActionIcon = staged ? Minus : Plus;

	return (
		<section aria-label={title}>
			<div className='group flex h-6 items-center gap-1 pr-1 pl-1'>
				<button
					type='button'
					onClick={() => setCollapsed((c) => !c)}
					aria-expanded={!collapsed}
					className='flex min-w-0 flex-1 items-center gap-1 text-11 font-medium tracking-widest text-fg-1 uppercase outline-none focus-visible:text-fg-0'
				>
					<ChevronDown
						size={12}
						className={cn(
							'transition-transform transition-fast',
							collapsed && '-rotate-90',
						)}
					/>
					<span className='truncate'>{title}</span>
					<span className='num ml-1 rounded-sm bg-bg-3 px-1 text-fg-1'>
						{changes.length}
					</span>
				</button>
				<IconButton
					size='sm'
					label={`${actionLabel} All`}
					icon={<ActionIcon size={12} />}
					disabled={busy}
					onClick={() => onToggle(changes.map((c) => c.path))}
				/>
			</div>
			{!collapsed && (
				<ul>
					{changes.map((change) => {
						const badge = BADGE[change.kind];
						const name = change.path.split('/').at(-1) ?? change.path;
						const dir = change.path.slice(0, -name.length - 1);
						return (
							<li
								key={`${staged ? 's' : 'u'}:${change.path}`}
								className='group flex h-6 cursor-default items-center gap-1.5 pr-1 pl-5 text-12 hover:bg-bg-2'
								title={`${change.path} — ${badge.label}${change.from ? ` (from ${change.from})` : ''}`}
							>
								<button
									type='button'
									onClick={() => onOpen(change)}
									className='flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none focus-visible:text-fg-0'
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
									{dir && (
										<span className='truncate text-11 text-fg-2'>{dir}</span>
									)}
								</button>
								<IconButton
									size='sm'
									label={`${actionLabel} ${name}`}
									icon={<ActionIcon size={12} />}
									disabled={busy}
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									onClick={() => onToggle([change.path])}
								/>
								<span
									className={cn(
										'num w-3 text-center text-11 font-semibold',
										badge.className,
									)}
									aria-label={badge.label}
								>
									{badge.letter}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
