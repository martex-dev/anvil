import { type JSX, useMemo, useState } from 'react';

import { Badge } from '../../ui/Badge';
import { attempt, formatGrouped, formatPlain, parseNumber } from './format';
import { NumberField } from './NumberField';
import { ResultRow } from './ResultRow';
import { ToolError } from './ToolError';
import { positionSize } from './tools';

export function PositionSizeTool(): JSX.Element {
	const [equity, setEquity] = useState('10000');
	const [risk, setRisk] = useState('1');
	const [entry, setEntry] = useState('');
	const [stop, setStop] = useState('');
	const [contract, setContract] = useState('');

	const result = useMemo(() => {
		const nums = [equity, risk, entry, stop].map(parseNumber);
		const [e, r, en, st] = nums;
		// Stay quiet until every required field has something in it; half-filled isn't an error.
		if (e == null || r == null || en == null || st == null) return null;
		const size = parseNumber(contract);
		return attempt(() =>
			positionSize({
				equity: e,
				riskPct: r,
				entry: en,
				stop: st,
				...(size == null ? {} : { contractSize: size }),
			}),
		);
	}, [equity, risk, entry, stop, contract]);

	const entryNum = parseNumber(entry) ?? 0;
	const stopNum = parseNumber(stop) ?? 0;
	const side = stopNum < entryNum ? 'Long' : 'Short';

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex flex-wrap gap-2'>
				<NumberField
					label='Equity'
					value={equity}
					onChange={setEquity}
					placeholder='10000'
				/>
				<NumberField label='Risk %' value={risk} onChange={setRisk} placeholder='1' />
				<NumberField label='Entry' value={entry} onChange={setEntry} placeholder='64250' />
				<NumberField label='Stop' value={stop} onChange={setStop} placeholder='63100' />
				<NumberField
					label='Contract size'
					value={contract}
					onChange={setContract}
					placeholder='1 (100000 = FX lot)'
				/>
			</div>
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<div className='flex flex-col gap-0.5'>
					<div className='mb-1'>
						<Badge tone={side === 'Long' ? 'up' : 'down'}>{side}</Badge>
					</div>
					<ResultRow
						label={parseNumber(contract) == null ? 'Units' : 'Contracts'}
						value={formatPlain(result.value.units)}
						highlight
					/>
					<ResultRow
						label='Notional'
						value={formatPlain(result.value.notional, 2)}
						display={formatGrouped(result.value.notional)}
					/>
					<ResultRow
						label='Risk amount'
						value={formatPlain(result.value.riskAmount, 2)}
						display={formatGrouped(result.value.riskAmount)}
					/>
					<ResultRow
						label='Stop distance'
						value={formatPlain(result.value.stopDistancePct, 4)}
						display={`${formatPlain(result.value.stopDistancePct, 4)}%`}
					/>
				</div>
			)}
			{!result && (
				<p className='text-12 text-fg-2'>
					Fill in equity, risk, entry and stop to size the position.
				</p>
			)}
		</div>
	);
}
