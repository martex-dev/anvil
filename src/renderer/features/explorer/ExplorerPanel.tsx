import { useIsFetching } from '@tanstack/react-query';
import { FilePlus, FolderMinus, FolderPlus, RefreshCw, X } from 'lucide-react';
import { type JSX, useRef } from 'react';

import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { FileTree, type FileTreeHandle } from './FileTree';
import { NoFolder } from './NoFolder';
import { closeFolder } from './workspace-actions';

export function ExplorerPanel(): JSX.Element {
	const { info, isLoading, error, refetch } = useWorkspace();
	const treeRef = useRef<FileTreeHandle | null>(null);
	// Any folder listing of this root in flight (Refresh, a watcher update): shown on Refresh.
	const refreshing =
		useIsFetching({
			queryKey: [...fsKeys.all, info.root ?? ''],
			predicate: (q) => q.queryKey[2] === 'list',
		}) > 0;

	if (isLoading) {
		return (
			<div className='flex h-full items-center justify-center'>
				<Spinner />
			</div>
		);
	}
	if (error) return <ErrorState message={error.message} onRetry={refetch} />;
	if (!info.root) {
		return (
			<div className='h-full overflow-auto'>
				<NoFolder recent={info.recent} />
			</div>
		);
	}

	return (
		<div className='flex h-full flex-col'>
			<div className='flex h-7 shrink-0 items-center gap-0.5 border-b border-glass-edge pr-1 pl-2'>
				<span
					className='min-w-0 flex-1 truncate text-11 font-medium tracking-widest text-fg-1 uppercase'
					title={info.root}
				>
					{info.name}
				</span>
				<IconButton
					size='sm'
					label='New File'
					icon={<FilePlus size={13} />}
					onClick={() => treeRef.current?.startCreate('file')}
				/>
				<IconButton
					size='sm'
					label='New Folder'
					icon={<FolderPlus size={13} />}
					onClick={() => treeRef.current?.startCreate('dir')}
				/>
				<IconButton
					size='sm'
					label='Refresh'
					aria-busy={refreshing}
					icon={refreshing ? <Spinner size={12} /> : <RefreshCw size={13} />}
					onClick={() => treeRef.current?.refresh()}
				/>
				<IconButton
					size='sm'
					label='Collapse All'
					icon={<FolderMinus size={13} />}
					onClick={() => treeRef.current?.collapseAll()}
				/>
				<IconButton
					size='sm'
					label='Close Folder'
					icon={<X size={13} />}
					onClick={closeFolder}
				/>
			</div>
			<div className='min-h-0 flex-1 overflow-auto'>
				{/* Keyed by root: a different folder gets a fresh tree state. */}
				<FileTree key={info.root} root={info.root} handleRef={treeRef} />
			</div>
		</div>
	);
}
