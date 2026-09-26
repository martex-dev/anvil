import { type JSX, useEffect, useState } from 'react';

import { ColophonItem } from './ColophonItem';

/** Hours and minutes, like the time set at the foot of a letter. */
export function ColophonClock(): JSX.Element {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 10_000);
		return () => clearInterval(id);
	}, []);
	const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
	return (
		<ColophonItem title={`${now.toLocaleString()}\nUTC ${now.toISOString().slice(11, 16)}`}>
			<span className='zn-num'>{time}</span>
		</ColophonItem>
	);
}
