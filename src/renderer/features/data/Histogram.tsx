import type { JSX } from 'react';

import type { ColumnStats } from '@shared/ipc/channels/data';

import { formatCount, histogramSummary } from './data-format';

interface HistogramProps {
	bins: ColumnStats['histogram'];
	/** Numeric columns get equal-width bins drawn as columns; others are top-value bars. */
	numeric: boolean;
	/** Axis labels; bin labels are left edges, so the right end needs the true max. */
	edges?: { min: string; max: string };
}

export function Histogram({ bins, numeric, edges }: HistogramProps): JSX.Element {
	const max = Math.max(1, ...bins.map((b) => b.count));

	if (numeric) {
		const first = edges?.min ?? bins[0]?.label ?? '';
		const last = edges?.max ?? bins[bins.length - 1]?.label ?? '';
		return (
			<div>
				<div
					className='flex h-28 items-end gap-px border-b border-border'
					role='img'
					aria-label={histogramSummary(bins, first, last)}
				>
					{bins.map((bin, i) => (
						<div
							key={i}
							title={`${bin.label}: ${formatCount(bin.count)}`}
							className='accent-gradient min-w-0 flex-1 rounded-t-sm opacity-80 transition-fast hover:opacity-100'
							style={{
								height:
									bin.count > 0 ? `${Math.max(2, (bin.count / max) * 100)}%` : 0,
							}}
						/>
					))}
				</div>
				<div className='num mt-1 flex justify-between gap-2 text-10 text-fg-2'>
					<span className='truncate'>{first}</span>
					<span className='truncate text-right'>{last}</span>
				</div>
			</div>
		);
	}

	return (
		<ul className='flex flex-col gap-1'>
			{bins.map((bin, i) => (
				<li
					key={i}
					className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5'
				>
					<span className='num truncate text-10 text-fg-1' title={bin.label}>
						{bin.label === '' ? '(empty)' : bin.label}
					</span>
					<span className='num text-10 text-fg-2'>{formatCount(bin.count)}</span>
					<span className='col-span-2 h-1 overflow-hidden rounded-full bg-bg-3'>
						<span
							className='accent-gradient block h-full rounded-full'
							style={{ width: `${Math.max(1, (bin.count / max) * 100)}%` }}
						/>
					</span>
				</li>
			))}
		</ul>
	);
}
