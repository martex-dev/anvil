import { type JSX, useEffect, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { useGitStatus } from '../../features/git/use-git';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';

function useToday(): string {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(id);
	}, []);
	return now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * A marquee of the session's headline facts, like the ticker strip on a newspaper poster.
 * The line is printed twice so the loop is seamless; with effects off it simply stands still.
 */
export function StatusTicker(): JSX.Element {
	const { info } = useWorkspace();
	const { status } = useGitStatus();
	const tab = useTabsStore((s) => focusedTab(s));
	const today = useToday();
	const changes = status?.isRepo ? status.staged.length + status.unstaged.length : 0;
	const facts = [
		info.name ?? 'No folder open',
		status?.isRepo ? `Branch ${status.branch ?? 'detached'}` : 'No repository',
		changes > 0 ? `${changes} uncommitted` : 'Clean tree',
		tab ? `Editing ${tab.title}` : 'Nothing open',
		today,
	];
	const line = (
		<span className='cc-ticker-line'>
			{facts.map((f, i) => (
				<span key={i} className='cc-ticker-fact'>
					{f}
				</span>
			))}
		</span>
	);
	return (
		<div className='cc-ticker' aria-hidden>
			<div className='cc-ticker-track'>
				{line}
				{line}
			</div>
		</div>
	);
}
