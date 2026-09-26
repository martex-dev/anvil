import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { TapeCell } from './TapeCell';

/** "GIT MAIN +2  ▲1 ▼0": branch, working changes, and the sync position like a spread. */
export function TapeGit(): JSX.Element | null {
	const { status } = useGitStatus();
	if (!status?.isRepo) return null;
	const changes = status.staged.length + status.unstaged.length;
	const branch = status.branch ?? 'DETACHED';
	return (
		<>
			<TapeCell
				onClick={() => runCommandById('git.switchBranch')}
				title={`${branch}${status.tracking ? ` → ${status.tracking}` : ''}\nClick to switch branch`}
			>
				<span className='ck-field-label'>GIT</span>
				<span className='ck-field-value' data-git-branch={status.branch ?? ''}>
					{branch}
				</span>
				<span className={changes > 0 ? 'ck-field-warn num' : 'ck-field-dim num'}>
					+{changes}
				</span>
			</TapeCell>
			{(status.ahead > 0 || status.behind > 0) && (
				<TapeCell
					onClick={() => runCommandById('git.sync')}
					title={`${status.behind} behind, ${status.ahead} ahead. Click to sync`}
				>
					<span className='ck-field-up num'>▲{status.ahead}</span>
					<span className='ck-field-down num'>▼{status.behind}</span>
				</TapeCell>
			)}
		</>
	);
}
