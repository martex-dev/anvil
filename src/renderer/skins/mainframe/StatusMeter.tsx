import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { call } from '../../lib/ipc';
import { StatusSeg } from './StatusSeg';

/** Anvil's own footprint, like a `top` summary line: `mem 312M cpu 4%`. */
export function StatusMeter(): JSX.Element | null {
	const q = useQuery({
		queryKey: ['app', 'metrics'],
		queryFn: () => call('app:metrics'),
		refetchInterval: 4000,
	});
	if (!q.data) return null;
	const { memoryMb, cpuPercent, processes } = q.data;
	return (
		<StatusSeg
			title={`Anvil: ${memoryMb} MB across ${processes} processes, ${cpuPercent}% CPU`}
		>
			<span className='text-fg-2'>mem</span>
			<span>{memoryMb >= 1024 ? `${(memoryMb / 1024).toFixed(1)}G` : `${memoryMb}M`}</span>
			<span className='text-fg-2'>cpu</span>
			<span className={cpuPercent > 50 ? 'text-warn' : ''}>{cpuPercent.toFixed(0)}%</span>
		</StatusSeg>
	);
}
