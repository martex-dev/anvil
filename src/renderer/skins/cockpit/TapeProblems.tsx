import type { JSX } from 'react';

import { useProblems } from '../../features/problems/problems-store';
import { useLayoutStore } from '../../stores/layout-store';
import { TapeCell } from './TapeCell';

/** "ERR 8  WRN 38", lit in the down and warn colors only when non-zero. */
export function TapeProblems(): JSX.Element {
	const errors = useProblems((s) => s.errors);
	const warnings = useProblems((s) => s.warnings);
	return (
		<TapeCell
			onClick={() => useLayoutStore.getState().togglePanel('problems')}
			title='Problems'
		>
			<span className='ck-field-label'>ERR</span>
			<span className={errors ? 'ck-field-down num' : 'ck-field-dim num'}>{errors}</span>
			<span className='ck-field-label'>WRN</span>
			<span className={warnings ? 'ck-field-warn num' : 'ck-field-dim num'}>{warnings}</span>
		</TapeCell>
	);
}
