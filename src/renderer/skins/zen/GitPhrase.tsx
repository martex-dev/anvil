import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { ColophonItem } from './ColophonItem';

/** The branch in italic, with pending changes and sync counts after it. */
export function GitPhrase(): JSX.Element | null {
	const { status } = useGitStatus();
	if (!status?.isRepo) return null;
	const changes = status.staged.length + status.unstaged.length;
	const branch = status.branch ?? 'detached';
	return (
		<>
			<ColophonItem
				onClick={() => runCommandById('git.switchBranch')}
				title={`${branch}${status.tracking ? ` → ${status.tracking}` : ''}\nSwitch branch`}
				className='zn-branch'
			>
				<span data-git-branch={status.branch ?? ''}>{branch}</span>
				{changes > 0 && (
					<span className='zn-accent'>
						{' '}
						+<span className='zn-num'>{changes}</span>
					</span>
				)}
			</ColophonItem>
			{(status.ahead > 0 || status.behind > 0) && (
				<ColophonItem
					onClick={() => runCommandById('git.sync')}
					title={`${status.behind} behind, ${status.ahead} ahead. Sync`}
				>
					<span className='zn-num'>{status.behind}</span>↓{' '}
					<span className='zn-num'>{status.ahead}</span>↑
				</ColophonItem>
			)}
		</>
	);
}
