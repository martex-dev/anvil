import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { StatusSeg } from './StatusSeg';

/** `git:main +3 ↓1↑2`, click to switch branch or sync. */
export function StatusGit(): JSX.Element | null {
	const { status } = useGitStatus();
	if (!status?.isRepo) return null;
	const changes = status.staged.length + status.unstaged.length;
	const drift = status.ahead > 0 || status.behind > 0;
	return (
		<>
			<StatusSeg
				onClick={() => runCommandById('git.switchBranch')}
				title={`${status.branch ?? 'detached'}${status.tracking ? ` → ${status.tracking}` : ''}\nClick to switch branch`}
			>
				<span className='text-fg-2'>git:</span>
				<span data-git-branch={status.branch ?? ''}>{status.branch ?? '(detached)'}</span>
				{changes > 0 && <span className='text-warn'>+{changes}</span>}
			</StatusSeg>
			{drift && (
				<StatusSeg
					onClick={() => runCommandById('git.sync')}
					title={`${status.behind} behind, ${status.ahead} ahead. Click to sync`}
				>
					{status.behind}↓{status.ahead}↑
				</StatusSeg>
			)}
		</>
	);
}
