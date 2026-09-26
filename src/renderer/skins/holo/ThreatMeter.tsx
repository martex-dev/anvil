import type { JSX } from 'react';

import { useProblems } from '../../features/problems/problems-store';
import { useLayoutStore } from '../../stores/layout-store';
import { type MeterLevel, SegmentMeter } from './SegmentMeter';
import { StatusCell } from './StatusCell';

/** Problems as a threat meter: log-scaled so a handful of errors already reads as serious. */
export function ThreatMeter(): JSX.Element {
	const errors = useProblems((s) => s.errors);
	const warnings = useProblems((s) => s.warnings);
	const level: MeterLevel = errors > 0 ? 'crit' : warnings > 0 ? 'warn' : 'ok';
	const value = Math.log10(1 + errors * 4 + warnings) / 2;
	return (
		<StatusCell
			tag='THREAT'
			title={`Problems: ${errors} errors, ${warnings} warnings. Click to open`}
			onClick={() => useLayoutStore.getState().togglePanel('problems')}
		>
			<SegmentMeter value={value} level={level} segments={8} />
			{level === 'ok' ? (
				<span className='ho-cell-value text-up'>NOMINAL</span>
			) : (
				<span className='num ho-cell-value'>
					<span className={errors ? 'text-down' : ''}>{errors}</span>
					<span className='ho-cell-unit'>ERR</span>
					<span className={warnings ? 'text-warn' : ''}>{warnings}</span>
					<span className='ho-cell-unit'>WRN</span>
				</span>
			)}
		</StatusCell>
	);
}
