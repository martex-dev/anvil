import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ChevronDown, Copy, Trash2 } from 'lucide-react';
import { type JSX, useState } from 'react';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { IconButton } from '../../ui/IconButton';
import { GIT_STASHES_KEY, stashAction, stashChanges } from './git-actions';

/** The Stashes section under the change lists: stash, then pop, apply or drop each entry. */
export function StashList({ root, busy }: { root: string; busy: boolean }): JSX.Element {
	const [collapsed, setCollapsed] = useState(false);
	const { data: stashes = [], error } = useQuery({
		queryKey: [...GIT_STASHES_KEY, root],
		queryFn: () => call('git:stashList'),
	});

	return (
		<section aria-label='Stashes' className='mt-1'>
			<div className='flex h-6 items-center gap-1 pr-1 pl-1'>
				<button
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
					<span className='truncate'>Stashes</span>
					<span className='num ml-1 rounded-sm bg-bg-3 px-1 text-fg-1'>
						{stashes.length}
					</span>
				</button>
				<IconButton
					size='sm'
					label='Stash All Changes (with untracked files)'
					icon={<Archive size={12} />}
					disabled={busy}
					onClick={() => void stashChanges()}
				/>
			</div>
			{!collapsed &&
				(error ? (
					<p
						role='alert'
						className='truncate pr-1 pl-5 text-11 text-down'
						title={error.message}
					>
						Could not list stashes: {error.message}
					</p>
				) : stashes.length === 0 ? (
					<p className='pr-1 pl-5 text-11 text-fg-2'>No stashes.</p>
				) : (
					<ul>
						{stashes.map((s) => (
							<li
								key={s.index}
								className='group flex h-6 items-center gap-1.5 pr-1 pl-5 text-12 hover:bg-bg-2'
								title={`stash@{${s.index}} · ${new Date(s.date).toLocaleString([], { hour12: false })}`}
							>
								<Archive size={12} className='shrink-0 text-fg-2' />
								<span className='min-w-0 flex-1 truncate text-fg-0'>
									{s.message}
								</span>
								<IconButton
									size='sm'
									label={`Pop ${s.message}`}
									icon={<ArchiveRestore size={12} />}
									disabled={busy}
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									onClick={() => void stashAction('pop', s)}
								/>
								<IconButton
									size='sm'
									label={`Apply ${s.message} (keep the stash)`}
									icon={<Copy size={12} />}
									disabled={busy}
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									onClick={() => void stashAction('apply', s)}
								/>
								<IconButton
									size='sm'
									label={`Drop ${s.message}`}
									icon={<Trash2 size={12} />}
									disabled={busy}
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									onClick={() => void stashAction('drop', s)}
								/>
							</li>
						))}
					</ul>
				))}
		</section>
	);
}
