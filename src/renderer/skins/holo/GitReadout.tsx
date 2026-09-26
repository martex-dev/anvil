import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { StatusCell } from './StatusCell';

/** Branch, pending changes and sync state as the NAV//GIT readout. */
export function GitReadout(): JSX.Element | null {
	const { status } = useGitStatus();
	if (!status?.isRepo) return null;
	const changes = status.staged.length + status.unstaged.length;
	return (
		<>
			<StatusCell
				tag='NAV//GIT'
				onClick={() => runCommandById('git.switchBranch')}
				title={`${status.branch ?? 'detached'}${status.tracking ? ` → ${status.tracking}` : ''}\nClick to switch branch`}
			>
				<span className='num ho-cell-value' data-git-branch={status.branch ?? ''}>
					{status.branch ?? '(detached)'}
				</span>
				{changes > 0 && <span className='num text-warn'>Δ{changes}</span>}
			</StatusCell>
			{(status.ahead > 0 || status.behind > 0) && (
				<StatusCell
					tag='SYNC'
					onClick={() => runCommandById('git.sync')}
					title={`${status.behind} behind, ${status.ahead} ahead. Click to sync`}
				>
					<span className='num ho-cell-value'>
						{status.behind}↓ {status.ahead}↑
					</span>
				</StatusCell>
			)}
		</>
	);
}
