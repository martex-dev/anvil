import { type JSX, useEffect, useState } from 'react';

import { StatusCell } from './StatusCell';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Mission elapsed time since this window started (T+hh:mm:ss), with local time beside it. */
export function MissionClock(): JSX.Element {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);
	const elapsed = Math.max(0, Math.floor((now - performance.timeOrigin) / 1000));
	const met = `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor(elapsed / 60) % 60)}:${pad(elapsed % 60)}`;
	const date = new Date(now);
	return (
		<StatusCell
			tag='T+'
			title={`Mission elapsed time since launch\nLocal ${date.toLocaleString()}\nUTC ${date.toISOString()}`}
			className='ho-clock'
		>
			<span className='num ho-cell-value ho-met'>{met}</span>
			<span className='num ho-cell-unit ho-clock-local'>
				{date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
			</span>
		</StatusCell>
	);
}
