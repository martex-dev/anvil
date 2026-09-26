import { useQuery } from '@tanstack/react-query';
import { type JSX, useEffect, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { pickPythonEnv, useSelectedPython } from '../../features/python/use-python';
import { call } from '../../lib/ipc';
import { TickValue } from './TickValue';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * The right half of the command line: live figures a desk shows in its header, all real:
 * interpreter, Anvil's own CPU and memory, the date and local and UTC time.
 */
export function DeskReadouts(): JSX.Element {
	const { info } = useWorkspace();
	const { env } = useSelectedPython();
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	const metrics = useQuery({
		queryKey: ['app', 'metrics'],
		queryFn: () => call('app:metrics'),
		refetchInterval: 4000,
	});
	const m = metrics.data;
	const version = env?.version?.split('.').slice(0, 2).join('.');
	const date = `${DAYS[now.getDay()] ?? ''} ${pad(now.getDate())} ${MONTHS[now.getMonth()] ?? ''} ${String(now.getFullYear()).slice(2)}`;
	const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
	const utc = now.toISOString().slice(11, 16);

	return (
		<div className='ck-readouts'>
			{info.root && (
				<button
					type='button'
					className='ck-readout ck-readout-btn ck-readout-py no-drag'
					onClick={() => void pickPythonEnv()}
					title={env ? `${env.label}\n${env.path}\nClick to change` : 'Pick a Python'}
				>
					<span className='ck-field-label'>PY</span>
					{env ? (
						<>
							<span className='ck-field-value num'>{version ?? '?'}</span>
							<span className='ck-field-dim'>{env.local ? env.label : env.kind}</span>
						</>
					) : (
						<span className='ck-field-down'>NONE</span>
					)}
				</button>
			)}
			{m && (
				<span
					className='ck-readout'
					title={`Anvil: ${m.memoryMb} MB across ${m.processes} processes, ${m.cpuPercent}% CPU`}
				>
					<span className='ck-field-label'>CPU</span>
					<TickValue value={m.cpuPercent} text={`${m.cpuPercent.toFixed(1)}%`} invert />
					<span className='ck-field-label'>MEM</span>
					<TickValue
						value={m.memoryMb}
						text={
							m.memoryMb >= 1024
								? `${(m.memoryMb / 1024).toFixed(2)}G`
								: `${m.memoryMb}M`
						}
						invert
					/>
				</span>
			)}
			<span className='ck-readout ck-readout-date' title={now.toLocaleString()}>
				<span className='ck-field-value num'>{date}</span>
			</span>
			<span className='ck-readout ck-clock' title={`UTC ${now.toISOString()}`}>
				<span className='ck-clock-time num'>{time}</span>
				<span className='ck-field-label'>UTC</span>
				<span className='ck-field-dim num'>{utc}</span>
			</span>
		</div>
	);
}
