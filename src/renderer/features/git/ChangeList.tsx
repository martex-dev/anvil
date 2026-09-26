import { ChevronDown, FileCode2, Minus, Plus } from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';

import type { GitChange, GitChangeKind } from '@shared/ipc/channels/git';

import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';
import { capRows, refocusIndex } from './change-rows';

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
	const listRef = useRef<HTMLUListElement>(null);
	const headerRef = useRef<HTMLButtonElement>(null);
	// Index of the row whose (un)stage button was used. That row moves to the other list, so
	// once the operation (and the status refresh) is done, focus goes to the row now there.
	const pendingFocus = useRef<number | null>(null);
	useEffect(() => {
		const index = pendingFocus.current;
		if (busy || index === null) return;
		pendingFocus.current = null;
		// Only fix up focus that was lost; never pull it from somewhere the user moved it to.
		const active = document.activeElement;
		const lost =
			!active ||
			active === document.body ||
			!active.isConnected ||
			(listRef.current?.contains(active) ?? false);
		if (!lost) return;
		const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-toggle]') ?? [];
		const target = refocusIndex(index, buttons.length);
		(target === null ? headerRef.current : buttons[target])?.focus();
	}, [busy, changes]);

	if (changes.length === 0) return null;
	const actionLabel = staged ? 'Unstage' : 'Stage';
	const ActionIcon = staged ? Minus : Plus;
	const { shown, hidden } = capRows(changes);

	return (
		<section aria-label={title}>
			<div className='group flex h-6 items-center gap-1 pr-1 pl-1'>
				<button
					ref={headerRef}
					type='button'
					onClick={() => setCollapsed((c) => !c)}
					aria-expanded={!collapsed}
					className='flex min-w-0 flex-1 items-center gap-1 text-11 font-medium tracking-widest text-fg-1 uppercase outline-none focus-visible:text-fg-0 focus-visible:shadow-glow'
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
				<ul ref={listRef}>
					{shown.map((change, index) => {
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
									{dir && (
										<span className='truncate text-11 text-fg-2'>{dir}</span>
									)}
									{/* The badge letter is aria-hidden (aria-label is ignored on a plain
									span); the status is spoken with the file name instead. */}
									<span className='sr-only'>, {badge.label}</span>
								</button>
								<IconButton
									size='sm'
									label={`${actionLabel} ${name}`}
									icon={<ActionIcon size={12} />}
									disabled={busy}
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									data-toggle
									onClick={() => {
										pendingFocus.current = index;
										onToggle([change.path]);
									}}
								/>
								<span
									aria-hidden
									className={cn(
										'num w-3 text-center text-11 font-semibold',
										badge.className,
									)}
								>
									{badge.letter}
								</span>
							</li>
						);
					})}
					{hidden > 0 && (
						<li className='num h-6 truncate pr-1 pl-5 text-11 leading-6 text-fg-2'>
							{hidden.toLocaleString()} more file{hidden === 1 ? '' : 's'}… (add
							folders like venv to .gitignore)
						</li>
					)}
				</ul>
			)}
		</section>
	);
}
