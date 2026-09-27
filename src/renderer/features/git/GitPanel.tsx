import { GitBranch, TriangleAlert } from 'lucide-react';
import { type JSX, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { ChangeList } from './ChangeList';
import { CommitBox } from './CommitBox';
import { GitConfirmDialog } from './GitConfirmDialog';
import { GitHeader } from './GitHeader';
import { openDiff } from './open-diff';
import { useGitActions, useGitStatus } from './use-git';

export { openDiff } from './open-diff';

function GitPanelBody(): JSX.Element {
	const { info } = useWorkspace();
	const { status, isLoading, error, refetch } = useGitStatus();
	const actions = useGitActions(status);
	// Only a refresh the user asked for shows a spinner; the 5 s poll would make it flicker.
	const [refreshing, setRefreshing] = useState(false);
	const refresh = (): void => {
		setRefreshing(true);
		void refetch().finally(() => setRefreshing(false));
	};

	if (!info.root) {
		return (
			<EmptyState
				icon={<GitBranch size={22} />}
				title='No folder open'
				description='Open a project to see its changes.'
			/>
		);
	}
	if (isLoading) {
		return (
			<div className='flex h-24 items-center justify-center'>
				<Spinner label='Reading repository' />
			</div>
		);
	}
	// Only a failure with nothing to show replaces the panel. A failed poll after a good one (a
	// terminal git holding the index lock) keeps the last status, and the unsent commit message.
	if (error && !status)
		return <ErrorState title='Git failed' message={error.message} onRetry={refresh} />;
	if (!status?.isRepo) {
		return (
			<EmptyState
				icon={<GitBranch size={22} />}
				title='Not a git repository'
				description='Run `git init` in a terminal to start tracking this folder.'
			/>
		);
	}

	const clean = status.staged.length === 0 && status.unstaged.length === 0;
	return (
		<div className='flex h-full flex-col'>
			<GitHeader
				status={status}
				actions={actions}
				refreshing={refreshing}
				onRefresh={refresh}
			/>
			{error && (
				<div
					role='status'
					className='flex shrink-0 items-center gap-1.5 border-b border-glass-edge py-0.5 pr-1 pl-2 text-11 text-warn'
				>
					<TriangleAlert size={12} className='shrink-0' />
					<span className='min-w-0 flex-1 truncate' title={error.message}>
						Couldn&rsquo;t refresh: {error.message}
					</span>
					<Button variant='ghost' size='sm' loading={refreshing} onClick={refresh}>
						Retry
					</Button>
				</div>
			)}
			<CommitBox
				root={info.root}
				branch={status.branch}
				stagedCount={status.staged.length}
				busy={actions.busy}
				onCommit={actions.commit}
			/>
			<div className='min-h-0 flex-1 overflow-auto pb-2'>
				{clean ? (
					<p className='px-3 py-4 text-center text-12 text-fg-2'>
						No changes. Working tree is clean.
					</p>
				) : (
					<>
						<ChangeList
							title='Staged Changes'
							changes={status.staged}
							staged
							busy={actions.busy}
							onOpen={(c) => void openDiff(c, true)}
							onToggle={actions.unstage}
						/>
						<ChangeList
							title='Changes'
							changes={status.unstaged}
							staged={false}
							busy={actions.busy}
							onOpen={(c) => void openDiff(c, false)}
							onToggle={actions.stage}
						/>
					</>
				)}
			</div>
		</div>
	);
}

export function GitPanel(): JSX.Element {
	return (
		<>
			<GitPanelBody />
			{/* Outside the body's early returns: palette commands ask here in every state. */}
			<GitConfirmDialog />
		</>
	);
}
