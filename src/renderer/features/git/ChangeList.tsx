import { ChevronDown, Minus, Plus, Undo2 } from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';

import type { GitChange } from '@shared/ipc/channels/git';

import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';
import { capRows, refocusIndex, togglePaths, togglePathsAll } from './change-rows';
import { ChangeRow } from './ChangeRow';

interface ChangeListProps {
	title: string;
	changes: GitChange[];
	staged: boolean;
	onOpen: (change: GitChange) => void;
	onToggle: (paths: string[]) => void;
	/** Unstaged list only: throw changes away (asks first). */
	onDiscard?: ((changes: GitChange[]) => void) | undefined;
	busy: boolean;
}

export function ChangeList({
	title,
	changes,
	staged,
	onOpen,
	onToggle,
	onDiscard,
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
				{onDiscard && (
					<IconButton
						size='sm'
						label='Discard All Changes'
						icon={<Undo2 size={12} />}
						disabled={busy}
						onClick={() => onDiscard(changes)}
					/>
				)}
				<IconButton
					size='sm'
					label={`${actionLabel} All`}
					icon={<ActionIcon size={12} />}
					disabled={busy}
					onClick={() => onToggle(togglePathsAll(changes, staged))}
				/>
			</div>
			{!collapsed && (
				<ul ref={listRef}>
					{shown.map((change, index) => (
						<ChangeRow
							key={`${staged ? 's' : 'u'}:${change.path}`}
							change={change}
							staged={staged}
							busy={busy}
							onOpen={() => onOpen(change)}
							onToggle={() => {
								pendingFocus.current = index;
								onToggle(togglePaths(change, staged));
							}}
							onDiscard={
								onDiscard && change.kind !== 'conflicted'
									? () => onDiscard([change])
									: undefined
							}
						/>
					))}
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
