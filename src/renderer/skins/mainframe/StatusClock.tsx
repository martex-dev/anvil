import { type JSX, useEffect, useState } from 'react';

import { everySecond } from '../../lib/every-second';
import { StatusSeg } from './StatusSeg';

/** tmux's clock block: date and local time in reverse video, UTC in the tooltip. */
export function StatusClock(): JSX.Element {
	const [now, setNow] = useState(() => new Date());
	// Aligned to the second, so it changes together with the system clock.
	useEffect(() => everySecond(setNow), []);
	const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
	return (
		<StatusSeg
			rev
			title={`Local ${now.toLocaleString()}\nUTC ${now.toISOString()}`}
			className='mf-clock'
		>
			<span className='mf-clock-date'>{date}</span>
			<span>{now.toLocaleTimeString([], { hour12: false })}</span>
		</StatusSeg>
	);
}
