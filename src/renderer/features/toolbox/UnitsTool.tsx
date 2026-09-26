import { type JSX, useMemo } from 'react';

import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Field } from './Field';
import { attempt } from './format';
import { ResultRow } from './ResultRow';
import { useToolField } from './toolbox-store';
import { ToolError } from './ToolError';
import { convertUnits, type UnitFamily, type UnitId, UNITS } from './tools';

const FAMILY_LABELS: Record<UnitFamily, string> = {
	rate: 'Rates',
	ethereum: 'Ethereum',
	solana: 'Solana',
	bitcoin: 'Bitcoin',
};

const UNIT_OPTIONS = UNITS.map((u) => ({
	value: u.id,
	label: `${u.label} · ${FAMILY_LABELS[u.family]}`,
}));

function isUnitId(value: string): value is UnitId {
	return UNITS.some((u) => u.id === value);
}

export function UnitsTool(): JSX.Element {
	const [value, setValue] = useToolField('units.value', '1');
	const [unit, setUnit] = useToolField<UnitId>('units.unit', 'eth');
	const filled = value.trim() !== '';
	const family = UNITS.find((u) => u.id === unit)?.family ?? 'rate';

	const result = useMemo(
		() => (filled ? attempt(() => convertUnits(value, unit)) : null),
		[filled, value, unit],
	);

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex flex-wrap gap-2'>
				<Field label='Value' className='min-w-24 flex-1'>
					<Input
						aria-label='Value'
						placeholder='1.5'
						value={value}
						onChange={(e) => setValue(e.target.value)}
						className='num'
						spellCheck={false}
					/>
				</Field>
				<Field label='Unit' as='div' className='min-w-32 flex-1'>
					<Select
						aria-label='Unit'
						value={unit}
						onValueChange={(v) => isUnitId(v) && setUnit(v)}
						options={UNIT_OPTIONS}
						className='w-full'
					/>
				</Field>
			</div>
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<div className='flex flex-col gap-1'>
					<span className='hud'>{FAMILY_LABELS[family]}</span>
					<div className='flex flex-col gap-0.5'>
						{result.value.map((row) => (
							<ResultRow
								key={row.unit}
								label={row.label}
								value={row.value}
								highlight={row.unit === unit}
							/>
						))}
					</div>
				</div>
			)}
			{!filled && <p className='text-12 text-fg-2'>Enter a value to convert.</p>}
		</div>
	);
}
