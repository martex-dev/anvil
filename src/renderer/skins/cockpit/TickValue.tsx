import { type JSX, useState } from 'react';

interface TickValueProps {
	value: number;
	text: string;
	/** For readings where rising is bad (CPU, memory): up ticks take the down color. */
	invert?: boolean;
}

type Direction = 'up' | 'down' | 'flat';

/**
 * A figure that ticks like a quote: an arrow for the last move and a short flash of the up or
 * down color whenever the value changes.
 */
export function TickValue({ value, text, invert = false }: TickValueProps): JSX.Element {
	const [prev, setPrev] = useState(value);
	const [dir, setDir] = useState<Direction>('flat');
	const [tick, setTick] = useState(0);
	// Derived from the previous value during render (React's "adjust state on prop change").
	if (value !== prev) {
		setDir(value > prev ? 'up' : 'down');
		setPrev(value);
		setTick((n) => n + 1);
	}
	const good = dir === 'flat' ? 'flat' : (dir === 'up') !== invert ? 'up' : 'down';
	return (
		<span className='ck-tick num' data-tone={good}>
			{tick > 0 && <span key={tick} className='ck-tick-flash' aria-hidden />}
			<span className='ck-tick-text'>{text}</span>
			<span className='ck-tick-arrow' aria-hidden>
				{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'}
			</span>
		</span>
	);
}
