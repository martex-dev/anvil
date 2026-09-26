import { ArrowDown, ArrowUp } from 'lucide-react';
import { type JSX, type KeyboardEvent, type PointerEvent, useRef } from 'react';

import type { DataColumn } from '@shared/ipc/channels/data';

import { cn } from '../../lib/cn';
import {
	HEADER_HEIGHT,
	isNumericType,
	MIN_COLUMN_WIDTH,
	type SortState,
	typeTag,
} from './data-format';

interface GridHeaderProps {
	columns: DataColumn[];
	offsets: number[];
	gutter: number;
	width: number;
	colStart: number;
	colEnd: number;
	sort: SortState | null;
	selLeft: number;
	selRight: number;
	onSort: (column: number) => void;
	onResize: (column: number, width: number) => void;
}

/** px per Arrow key press on a resize handle. */
const RESIZE_STEP = 16;

export function GridHeader({
	columns,
	offsets,
	gutter,
	width,
	colStart,
	colEnd,
	sort,
	selLeft,
	selRight,
	onSort,
	onResize,
}: GridHeaderProps): JSX.Element {
	const drag = useRef<{ column: number; startX: number; startWidth: number } | null>(null);

	const startResize = (event: PointerEvent<HTMLDivElement>, column: number): void => {
		// The handle lives inside the sortable header cell; resizing must not also sort.
		event.stopPropagation();
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		const startWidth = (offsets[column + 1] ?? 0) - (offsets[column] ?? 0);
		drag.current = { column, startX: event.clientX, startWidth };
	};
	const moveResize = (event: PointerEvent<HTMLDivElement>): void => {
		const d = drag.current;
		if (!d) return;
		onResize(d.column, Math.max(MIN_COLUMN_WIDTH, d.startWidth + event.clientX - d.startX));
	};
	const endResize = (event: PointerEvent<HTMLDivElement>): void => {
		drag.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	const sortKey = (event: KeyboardEvent<HTMLDivElement>, column: number): void => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		onSort(column);
	};
	/** Keyboard resizing: Arrow keys nudge the column, Shift for bigger steps. */
	const resizeKey = (event: KeyboardEvent<HTMLDivElement>, column: number): void => {
		const step = event.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP;
		const delta = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
		// Enter/Space on the handle must not bubble up and sort the column.
		if (delta === 0 && event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		if (delta === 0) return;
		const current = (offsets[column + 1] ?? 0) - (offsets[column] ?? 0);
		onResize(column, Math.max(MIN_COLUMN_WIDTH, current + delta));
	};

	const cells: JSX.Element[] = [];
	for (let c = colStart; c < colEnd; c++) {
		const column = columns[c];
		if (!column) continue;
		const sorted = sort?.column === c ? sort : null;
		const selected = selLeft >= 0 && c >= selLeft && c <= selRight;
		cells.push(
			<div
				key={c}
				role='columnheader'
				aria-sort={sorted ? (sorted.desc ? 'descending' : 'ascending') : 'none'}
				tabIndex={0}
				title={`${column.name} · click or Enter to sort`}
				onClick={() => onSort(c)}
				onKeyDown={(e) => sortKey(e, c)}
				className={cn(
					'group/h absolute top-0 flex h-full cursor-pointer items-center gap-1.5 border-r border-border/60 px-2 focus-visible:-outline-offset-1',
					'transition-fast hover:bg-bg-3/70',
					isNumericType(column.type) && 'flex-row-reverse',
					selected && 'bg-accent-faint',
				)}
				style={{
					left: gutter + (offsets[c] ?? 0),
					width: (offsets[c + 1] ?? 0) - (offsets[c] ?? 0),
				}}
			>
				<span
					className={cn(
						'min-w-0 truncate text-12 font-medium',
						selected || sorted ? 'text-accent' : 'text-fg-0',
					)}
				>
					{column.name}
				</span>
				<span className='hud shrink-0 rounded-sm border border-border px-1 py-px leading-none'>
					{typeTag(column.type)}
				</span>
				{sorted &&
					(sorted.desc ? (
						<ArrowDown size={12} className='shrink-0 text-accent' />
					) : (
						<ArrowUp size={12} className='shrink-0 text-accent' />
					))}
				<div
					role='separator'
					aria-orientation='vertical'
					aria-label={`Resize ${column.name}`}
					aria-valuenow={Math.round((offsets[c + 1] ?? 0) - (offsets[c] ?? 0))}
					aria-valuemin={MIN_COLUMN_WIDTH}
					tabIndex={0}
					onKeyDown={(e) => resizeKey(e, c)}
					onPointerDown={(e) => startResize(e, c)}
					onPointerMove={moveResize}
					onPointerUp={endResize}
					onPointerCancel={endResize}
					onClick={(e) => e.stopPropagation()}
					className='absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize hover:bg-accent/40'
				/>
			</div>,
		);
	}

	return (
		<div
			role='row'
			aria-rowindex={1}
			className='sticky top-0 z-20 border-b border-glass-edge bg-bg-2/90'
			style={{ height: HEADER_HEIGHT, width }}
		>
			{cells}
			<div
				className='hud sticky left-0 z-10 flex h-full items-center justify-end border-r border-glass-edge bg-bg-2 pr-2'
				style={{ width: gutter }}
			>
				#
			</div>
		</div>
	);
}
