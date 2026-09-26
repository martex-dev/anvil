import { type JSX, useEffect, useState } from 'react';

import { useGitStatus } from '../../features/git/use-git';
import { useProblems } from '../../features/problems/problems-store';
import { useLayoutStore } from '../../stores/layout-store';
import { ROBOT, WARNING } from './art-tools';
import { BRANCH } from './art-views';
import { PixelIcon } from './PixelIcon';

/** Minutes are all a 1995 clock shows; ticking every few seconds keeps it on time. */
function useNow(): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 5000);
		return () => clearInterval(id);
	}, []);
	return now;
}

/** The sunken notification area: branch, problems, assistant, and the clock. */
export function WbTray(): JSX.Element {
	const now = useNow();
	const { status } = useGitStatus();
	const problems = useProblems((s) => s.errors + s.warnings);
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	const branch = status?.isRepo ? (status.branch ?? 'detached') : null;
	return (
		<div role='group' aria-label='Notification area' className='wb-tray'>
			{branch && (
				<button
					type='button'
					className='wb-tray-icon'
					title={`Branch: ${branch}`}
					aria-label={`Source control, branch ${branch}`}
					onClick={() => useLayoutStore.getState().showView('git')}
				>
					<PixelIcon art={BRANCH} />
				</button>
			)}
			{problems > 0 && (
				<button
					type='button'
					className='wb-tray-icon'
					title={`${problems} problems`}
					aria-label={`${problems} problems`}
					onClick={() => useLayoutStore.getState().showPanel('problems')}
				>
					<PixelIcon art={WARNING} />
				</button>
			)}
			<button
				type='button'
				className='wb-tray-icon'
				aria-pressed={aiOpen}
				title='AI assistant'
				aria-label='AI assistant'
				onClick={() => useLayoutStore.getState().toggleAi()}
			>
				<PixelIcon art={ROBOT} />
			</button>
			<span className='wb-clock num' title={now.toLocaleString()}>
				{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
			</span>
		</div>
	);
}
