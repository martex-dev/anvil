import { ChevronRight, Link2 } from 'lucide-react';
import { type JSX, memo } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { cn } from '../../lib/cn';
import { EntryIcon } from './EntryIcon';
import type { GitDecoration } from './explorer-git';
import { isFolder, treeItemId } from './tree-model';

const IGNORED = new Set([
	'node_modules',
	'.git',
	'.venv',
	'__pycache__',
	'out',
	'dist',
	'.ruff_cache',
	'.pytest_cache',
]);

interface TreeRowViewProps {
	entry: FsEntry;
	depth: number;
	expanded: boolean;
	focused: boolean;
	active: boolean;
	git: GitDecoration | undefined;
	/** Cut and waiting for Paste: shown faded, as in File Explorer. */
	cut: boolean;
	/** A drag is over this folder. */
	dropTarget: boolean;
}

/**
 * One explorer row. Pointer and drag events are handled once on the tree (by `data-path`), so a
 * row only re-renders when its own props change: a focus move repaints two rows, not thousands.
 */
export const TreeRowView = memo(function TreeRowView({
	entry,
	depth,
	expanded,
	focused,
	active,
	git,
	cut,
	dropTarget,
}: TreeRowViewProps): JSX.Element {
	const isDir = isFolder(entry);
	return (
		<div
			role='treeitem'
			data-part='tree-row'
			id={treeItemId(entry.path)}
			aria-level={depth + 1}
			aria-expanded={isDir ? expanded : undefined}
			aria-selected={focused}
			aria-description={git ? `${git.label}` : undefined}
			data-path={entry.path}
			data-git={git?.kind}
			data-drop-target={dropTarget || undefined}
			draggable
			title={git ? `${entry.path} · ${git.label}` : entry.path}
			className={cn(
				'relative flex h-6 cursor-default items-center gap-1.5 pr-2 text-12 select-none',
				focused ? 'bg-accent-faint text-fg-0' : 'text-fg-1 hover:bg-bg-3/40',
				active && 'text-accent',
				(IGNORED.has(entry.name) || cut) && 'opacity-45',
				dropTarget && 'bg-accent-soft outline outline-1 -outline-offset-1 outline-accent',
			)}
			style={{ paddingLeft: 8 + depth * 12 }}
		>
			{focused && (
				<span className='accent-line absolute top-1 bottom-1 left-0 w-[2px] rounded-full' />
			)}
			<ChevronRight
				size={12}
				className={cn(
					'shrink-0 text-fg-2 transition-transform transition-fast',
					!isDir && 'invisible',
					expanded && 'rotate-90',
				)}
			/>
			<span className='flex w-7 shrink-0 justify-center'>
				<EntryIcon kind={entry.kind} name={entry.name} open={expanded} />
			</span>
			<span className={cn('truncate', git && !active && git.tone)}>{entry.name}</span>
			{entry.isLink && entry.kind !== 'symlink' && (
				<Link2 size={11} className='shrink-0 text-fg-2' aria-label='link' />
			)}
			{git && (
				<span
					aria-hidden
					data-part='tree-git-badge'
					// A folder gets a dot in its most urgent colour; a file its letter (M, U, D...).
					className={cn(
						'ml-auto shrink-0',
						git.tone,
						isDir ? 'size-1.5 rounded-full bg-current' : 'font-mono text-10 font-bold',
					)}
				>
					{isDir ? null : git.letter}
				</span>
			)}
		</div>
	);
});
