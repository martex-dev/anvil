import { ArrowDown, ArrowUp, CloudDownload, CloudUpload, GitBranch, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';

import type { GitStatus } from '@shared/ipc/channels/git';

import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { switchBranch } from './branch-actions';
import type { useGitActions } from './use-git';

interface GitHeaderProps {
	status: GitStatus;
	actions: ReturnType<typeof useGitActions>;
	refreshing: boolean;
	onRefresh: () => void;
}

/** Branch, ahead/behind and the remote buttons above the commit box. */
export function GitHeader({ status, actions, refreshing, onRefresh }: GitHeaderProps): JSX.Element {
	return (
		<div className='flex h-7 shrink-0 items-center gap-1 border-b border-glass-edge pr-1 pl-2 text-12'>
			<button
				type='button'
				onClick={() => void switchBranch()}
				disabled={actions.busy}
				aria-label={`Branch ${status.branch ?? ''}: switch or create a branch`}
				title={`${status.tracking ? `Tracking ${status.tracking}` : 'No upstream'} · click to switch branch`}
				className='flex min-w-0 flex-1 items-center gap-1 rounded-sm text-left outline-none hover:text-accent focus-visible:shadow-glow disabled:opacity-60'
			>
				<GitBranch size={13} className='shrink-0 text-accent' />
				<span className='num min-w-0 truncate text-fg-0'>
					{status.detached ? `(detached) ${status.branch ?? ''}` : status.branch}
				</span>
			</button>
			{(status.ahead > 0 || status.behind > 0) && (
				<span
					className='num flex items-center gap-1 text-11 text-fg-1'
					title={`${status.behind} behind, ${status.ahead} ahead`}
				>
					<ArrowDown size={11} />
					{status.behind}
					<ArrowUp size={11} />
					{status.ahead}
				</span>
			)}
			<IconButton
				size='sm'
				label={
					actions.pulling
						? 'Pulling…'
						: status.tracking
							? 'Pull'
							: 'Pull (no upstream: publish the branch first)'
				}
				icon={
					actions.pulling ? (
						<Spinner size={12} label='Pulling' />
					) : (
						<ArrowDown size={13} />
					)
				}
				// Without an upstream, git pull can only fail with "no tracking information".
				disabled={actions.busy || !status.tracking}
				onClick={actions.pull}
			/>
			<IconButton
				size='sm'
				label={actions.pushing ? 'Pushing…' : status.tracking ? 'Push' : 'Publish Branch'}
				icon={
					actions.pushing ? (
						<Spinner size={12} label='Pushing' />
					) : status.tracking ? (
						<ArrowUp size={13} />
					) : (
						<CloudUpload size={13} />
					)
				}
				disabled={actions.busy}
				onClick={actions.push}
			/>
			<IconButton
				size='sm'
				label={actions.fetching ? 'Fetching…' : 'Fetch (and prune deleted branches)'}
				icon={
					actions.fetching ? (
						<Spinner size={12} label='Fetching' />
					) : (
						<CloudDownload size={13} />
					)
				}
				disabled={actions.busy}
				onClick={actions.fetch}
			/>
			<IconButton
				size='sm'
				label={refreshing ? 'Refreshing…' : 'Refresh'}
				icon={
					refreshing ? <Spinner size={12} label='Refreshing' /> : <RefreshCw size={13} />
				}
				aria-busy={refreshing || undefined}
				onClick={onRefresh}
			/>
		</div>
	);
}
