import { type JSX, memo, type ReactNode } from 'react';

import type { DataColumn } from '@shared/ipc/channels/data';

import { cn } from '../../lib/cn';
import { isNegative, isNumericType, ROW_HEIGHT } from './data-format';

interface GridRowProps {
	index: number;
	/** px from the top of the scroll content. */
	top: number;
	cells: (string | null)[] | 'loading' | 'error';
	columns: DataColumn[];
	offsets: number[];
	gutter: number;
	width: number;
	colStart: number;
	colEnd: number;
	/** Selected column span for this row, or -1/-1 when the row is outside the selection. */
	selLeft: number;
	selRight: number;
}

function renderCell(value: string | null | undefined, column: DataColumn): ReactNode {
	if (value === null || value === undefined) {
		return <span className='text-fg-2/70 italic'>null</span>;
	}
	if (isNumericType(column.type)) {
		return <span className={cn('num', isNegative(value) && 'text-down')}>{value}</span>;
	}
	if (column.type === 'bool') {
		return (
			<span className={cn('num', value === 'true' ? 'text-info' : 'text-fg-1')}>{value}</span>
		);
	}
	if (column.type === 'date') return <span className='num text-fg-1'>{value}</span>;
	return value;
}

/** Memoized: in the common unscaled case only rows entering the viewport re-render on scroll. */
export const GridRow = memo(function GridRow({
	index,
	top,
	cells,
	columns,
	offsets,
	gutter,
	width,
	colStart,
	colEnd,
	selLeft,
	selRight,
}: GridRowProps): JSX.Element {
	const inSelection = selLeft >= 0;
	const items: JSX.Element[] = [];
	for (let c = colStart; c < colEnd; c++) {
		const column = columns[c];
		if (!column) continue;
		const left = gutter + (offsets[c] ?? 0);
		const w = (offsets[c + 1] ?? 0) - (offsets[c] ?? 0);
		const selected = inSelection && c >= selLeft && c <= selRight;
		let content: ReactNode;
		if (cells === 'loading') {
			content = <span className='shimmer block h-2 w-3/5 rounded-sm bg-bg-3/60' />;
		} else if (cells === 'error') {
			content = <span className='text-fg-2'>—</span>;
		} else {
			content = renderCell(cells[c], column);
		}
		items.push(
			<div
				key={c}
				data-row={index}
				data-col={c}
				className={cn(
					'absolute top-0 flex h-full items-center truncate border-r border-border/40 px-2',
					isNumericType(column.type) && 'justify-end text-right',
					selected && 'bg-accent-soft',
				)}
				style={{ left, width: w }}
			>
				{content}
			</div>,
		);
	}
	return (
		<div
			role='row'
			aria-rowindex={index + 2}
			className={cn(
				'group absolute left-0 text-12 text-fg-0 hover:bg-accent-faint',
				index % 2 === 1 && 'bg-bg-1/30',
			)}
			style={{ top, height: ROW_HEIGHT, width }}
		>
			{items}
			<div
				className={cn(
					'num sticky left-0 z-10 flex h-full items-center justify-end border-r border-glass-edge bg-bg-1 pr-2 text-11',
					inSelection ? 'text-accent' : 'text-fg-2',
				)}
				style={{ width: gutter }}
			>
				{index + 1}
			</div>
		</div>
	);
});
