/**
 * Calls `tick` on each wall-clock second boundary (…:00.000, …:01.000), re-aiming every time, so
 * a displayed HH:MM:SS changes together with the system clock and never drifts or skips a second
 * the way a free-running 1 s interval does. Returns the stop function.
 */
export function everySecond(tick: (now: Date) => void): () => void {
	let id: ReturnType<typeof setTimeout>;
	const arm = (): void => {
		id = setTimeout(
			() => {
				tick(new Date());
				arm();
			},
			1000 - (Date.now() % 1000),
		);
	};
	arm();
	return () => clearTimeout(id);
}
