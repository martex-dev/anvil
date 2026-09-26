import type { JSX } from 'react';

export type MeterLevel = 'ok' | 'warn' | 'crit';

/** A segmented power bar: `value` (0..1) lights that share of the slanted segments. */
export function SegmentMeter({
	value,
	level = 'ok',
	segments = 10,
}: {
	value: number;
	level?: MeterLevel;
	segments?: number;
}): JSX.Element {
	const lit = Math.round(Math.min(1, Math.max(0, value)) * segments);
	return (
		<span className='ho-meter' data-level={level} aria-hidden>
			{Array.from({ length: segments }, (_, i) => (
				<span key={i} className='ho-seg' data-lit={i < lit} />
			))}
		</span>
	);
}
