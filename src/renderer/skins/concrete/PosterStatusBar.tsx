import type { JSX } from 'react';

import { StatusBar } from '../../app/StatusBar';
import { StatusTicker } from './StatusTicker';

/**
 * The status strip, printed under the title band: a LIVE tag, a ticker of headline facts and
 * the shared status items set as uppercase segments between thick rules.
 */
export function PosterStatusBar(): JSX.Element {
	return (
		<div className='cc-band cc-status relative z-10 shrink-0'>
			<span className='cc-status-tag'>Live</span>
			<StatusTicker />
			<StatusBar />
		</div>
	);
}
