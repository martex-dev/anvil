import { type JSX, useMemo } from 'react';

import { cn } from '../../lib/cn';
import { attempt, formatGrouped, formatPlain, parseNumber } from './format';
import { NumberField } from './NumberField';
import { ResultRow } from './ResultRow';
import { useToolField } from './toolbox-store';
import { ToolError } from './ToolError';
import { compoundGrowth } from './tools';

export function CompoundTool(): JSX.Element {
	const [start, setStart] = useToolField('compound.start', '10000');
	const [rate, setRate] = useToolField('compound.rate', '');
	const [periods, setPeriods] = useToolField('compound.periods', '');
	const [contribution, setContribution] = useToolField('compound.contribution', '');

	const result = useMemo(() => {
		const s = parseNumber(start);
		const r = parseNumber(rate);
		const p = parseNumber(periods);
		if (s == null || r == null || p == null) return null;
		const c = parseNumber(contribution);
		return attempt(() =>
			compoundGrowth({
				start: s,
				ratePct: r,
				periods: p,
				...(c == null ? {} : { contribution: c }),
			}),
		);
	}, [start, rate, periods, contribution]);

	const returnPct =
		result?.ok && result.value.totalContributed > 0
			? (result.value.gain / result.value.totalContributed) * 100
			: null;

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex flex-wrap gap-2'>
				<NumberField label='Start' value={start} onChange={setStart} placeholder='10000' />
				<NumberField
					label='Rate % / period'
					value={rate}
					onChange={setRate}
					placeholder='2'
				/>
				<NumberField
					label='Periods'
					value={periods}
					onChange={setPeriods}
					placeholder='12'
				/>
				<NumberField
					label='Add / period'
					value={contribution}
					onChange={setContribution}
					placeholder='0'
				/>
			</div>
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<div className='flex flex-col gap-0.5'>
					<ResultRow
						label='Final'
						value={formatPlain(result.value.final, 2)}
						display={formatGrouped(result.value.final)}
						highlight
					/>
					<ResultRow
						label='Contributed'
						value={formatPlain(result.value.totalContributed, 2)}
						display={formatGrouped(result.value.totalContributed)}
					/>
					<ResultRow
						label='Gain'
						value={formatPlain(result.value.gain, 2)}
						display={
							<span className={cn(result.value.gain < 0 ? 'text-down' : 'text-up')}>
								{result.value.gain > 0 ? '+' : ''}
								{formatGrouped(result.value.gain)}
							</span>
						}
					/>
					{returnPct !== null && (
						<ResultRow
							label='Return'
							value={formatPlain(returnPct, 2)}
							display={`${formatGrouped(returnPct)}%`}
						/>
					)}
				</div>
			)}
			{!result && (
				<p className='text-12 text-fg-2'>
					Contributions are added at the end of each period.
				</p>
			)}
		</div>
	);
}
