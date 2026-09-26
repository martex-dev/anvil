import { ChevronRight, Link2 } from 'lucide-react';
import type { JSX } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { cn } from '../../lib/cn';
import { EntryIcon } from './EntryIcon';
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
	onClick: () => void;
	onDoubleClick: () => void;
	onContextMenu: () => void;
}

export function TreeRowView({
	entry,
	depth,
	expanded,
	focused,
	active,
	onClick,
	onDoubleClick,
	onContextMenu,
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
			data-path={entry.path}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
			onContextMenu={onContextMenu}
			title={entry.path}
			className={cn(
				'relative flex h-6 cursor-default items-center gap-1.5 pr-2 text-12 select-none',
				focused ? 'bg-accent-faint text-fg-0' : 'text-fg-1 hover:bg-bg-3/40',
				active && 'text-accent',
				IGNORED.has(entry.name) && 'opacity-45',
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
			<span className='truncate'>{entry.name}</span>
			{entry.isLink && entry.kind !== 'symlink' && (
				<Link2 size={11} className='shrink-0 text-fg-2' aria-label='link' />
			)}
		</div>
	);
}
