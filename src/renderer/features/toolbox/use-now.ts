import { useEffect, useState } from 'react';

/**
 * The current time, re-read every `intervalMs` while `active`, so relative labels ("3 minutes
 * ago") stay true without reading the clock during render.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [active, intervalMs]);
	return now;
}
