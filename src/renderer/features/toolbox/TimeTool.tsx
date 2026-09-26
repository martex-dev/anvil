import { Clock } from 'lucide-react';
import { type JSX, useEffect, useMemo, useState } from 'react';

import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Field } from './Field';
import { attempt } from './format';
import { ResultRow } from './ResultRow';
import { ToolError } from './ToolError';
import { convertTimestamp, type TimestampUnit } from './tools';

const UNIT_LABELS: Record<TimestampUnit, string> = {
	s: 'unix seconds',
	ms: 'unix milliseconds',
	us: 'unix microseconds',
	ns: 'unix nanoseconds',
	date: 'date string',
};

export function TimeTool(): JSX.Element {
	const [input, setInput] = useState('');
	const [now, setNow] = useState(() => Date.now());
	const filled = input.trim() !== '';

	// "Relative" should stay true while the panel is open, so tick only when there is a value.
	useEffect(() => {
		if (!filled) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [filled]);

	const result = useMemo(
		() => (filled ? attempt(() => convertTimestamp(input, now)) : null),
		[filled, input, now],
	);

	return (
		<div className='flex flex-col gap-3'>
			<Field label='Timestamp or date'>
				<div className='flex gap-1'>
					<Input
						aria-label='Timestamp or date'
						placeholder='1790000000, 1790000000000, 2026-09-26T12:00Z'
						value={input}
						onChange={(e) => setInput(e.target.value)}
						className='num min-w-0 flex-1'
						spellCheck={false}
					/>
					<Button
						size='md'
						icon={<Clock size={12} />}
						onClick={() => {
							const ms = Date.now();
							setNow(ms);
							setInput(String(Math.floor(ms / 1000)));
						}}
					>
						Now
					</Button>
				</div>
			</Field>
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<div className='flex flex-col gap-0.5'>
					<div className='mb-1'>
						<Badge tone='accent'>{UNIT_LABELS[result.value.detectedUnit]}</Badge>
					</div>
					<ResultRow label='Unix seconds' value={String(result.value.unixSeconds)} />
					<ResultRow label='Unix ms' value={String(result.value.unixMs)} />
					<ResultRow label='ISO (UTC)' value={result.value.iso} />
					<ResultRow label='Local' value={result.value.local} />
					<ResultRow label='Relative' value={result.value.relative} mono={false} />
				</div>
			)}
			{!filled && (
				<p className='text-12 text-fg-2'>
					Paste a unix timestamp in s, ms, µs or ns (the unit is detected from its size)
					or any ISO / RFC date.
				</p>
			)}
		</div>
	);
}
