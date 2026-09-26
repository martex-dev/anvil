import type { JSX } from 'react';

import type { DataColumn } from '@shared/ipc/channels/data';

import { Kbd } from '../../ui/Kbd';
import { formatCount, type SortState } from './data-format';
import { type GridSelection, rangeSize, selectionRange } from './grid-selection';

interface DataStatusBarProps {
	columns: DataColumn[];
	selection: GridSelection | null;
	sort: SortState | null;
}

/** The strip under the grid: what is selected, how it is sorted, and the grid's shortcuts. */
export function DataStatusBar({ columns, selection, sort }: DataStatusBarProps): JSX.Element {
	const range = selection ? selectionRange(selection) : null;
	const size = range ? rangeSize(range) : null;
	const sortedBy = sort ? columns[sort.column]?.name : undefined;
	return (
		<div className='flex h-6 shrink-0 items-center gap-3 border-t border-glass-edge px-3 text-11 text-fg-2'>
			<span className='num'>
				{range && size
					? size.rows === 1 && size.cols === 1
						? `R${formatCount(range.top + 1)} · ${columns[range.left]?.name ?? ''}`
						: `${formatCount(size.rows)} × ${formatCount(size.cols)} selected`
					: 'No selection'}
			</span>
			{sortedBy && (
				<span className='num'>
					sorted by <span className='text-accent'>{sortedBy}</span>{' '}
					{sort?.desc ? '↓' : '↑'}
				</span>
			)}
			<span className='flex-1' />
			<span className='hidden items-center gap-1 md:flex'>
				<Kbd keys='Ctrl+C' /> copy
				<span className='mx-1'>·</span>
				<Kbd keys='Shift' />
				+click range
				<span className='mx-1'>·</span>
				<Kbd keys='Ctrl+A' /> all
				<span className='mx-1'>·</span>
				<Kbd keys='Ctrl+F' /> filter
			</span>
		</div>
	);
}
