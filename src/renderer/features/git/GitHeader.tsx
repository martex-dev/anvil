import { ArrowDown, ArrowUp, CloudUpload, GitBranch, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';

import type { GitStatus } from '@shared/ipc/channels/git';

import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
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
			<GitBranch size={13} className='text-accent' />
			<span
				className='num min-w-0 flex-1 truncate text-fg-0'
				title={status.tracking ?? 'No upstream'}
			>
				{status.detached ? `(detached) ${status.branch ?? ''}` : status.branch}
			</span>
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
