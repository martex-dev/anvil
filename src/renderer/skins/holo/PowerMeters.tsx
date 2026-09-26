import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { call } from '../../lib/ipc';
import { SegmentMeter } from './SegmentMeter';
import { StatusCell } from './StatusCell';

/** Memory that fills the MEM bar: past this, Anvil is heavy for an editor. */
const MEM_FULL_MB = 2048;

/** Anvil's own CPU and memory draw as reactor power bars (all processes, polled). */
export function PowerMeters(): JSX.Element | null {
	const q = useQuery({
		queryKey: ['app', 'metrics'],
		queryFn: () => call('app:metrics'),
		refetchInterval: 4000,
	});
	if (!q.data) return null;
	const { memoryMb, cpuPercent, processes } = q.data;
	const cpu = Math.min(1, cpuPercent / 100);
	const mem = memoryMb / MEM_FULL_MB;
	const title = `Anvil: ${memoryMb} MB across ${processes} processes, ${cpuPercent}% CPU`;
	return (
		<>
			<StatusCell tag='CPU' title={title}>
				<SegmentMeter value={Math.max(cpu, 0.05)} level={cpu > 0.5 ? 'warn' : 'ok'} />
				<span className='num ho-cell-value'>{cpuPercent.toFixed(0)}%</span>
			</StatusCell>
			<StatusCell tag='MEM' title={title}>
				<SegmentMeter value={mem} level={mem > 0.75 ? 'warn' : 'ok'} />
				<span className='num ho-cell-value'>
					{memoryMb >= 1024 ? `${(memoryMb / 1024).toFixed(1)}G` : `${memoryMb}M`}
				</span>
			</StatusCell>
		</>
	);
}
