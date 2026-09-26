import { ArrowDown, ArrowUp } from 'lucide-react';
import { type JSX, type PointerEvent, useRef } from 'react';

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
				title={`${column.name} · click to sort`}
				onClick={() => onSort(c)}
				className={cn(
					'group/h absolute top-0 flex h-full cursor-pointer items-center gap-1.5 border-r border-border/60 px-2',
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
