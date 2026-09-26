import {
	type JSX,
	type KeyboardEvent,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import type { DataColumn } from '@shared/ipc/channels/data';

import { AppContextMenu } from '../../ui/ContextMenu';
import {
	columnOffsets,
	computeWindow,
	gutterWidth,
	HEADER_HEIGHT,
	ROW_HEIGHT,
	scrollTopForRow,
	visibleColumns,
} from './data-format';
import {
	type CellPos,
	type CellRange,
	type CopyOptions,
	type GridSelection,
	moveSelection,
	selectionRange,
} from './grid-selection';
import { GridHeader } from './GridHeader';
import { GridRow } from './GridRow';
import { type DataParams, useRowPages } from './use-data-pages';
import { gridMenuItems, useGridMouse } from './use-grid-mouse';

interface DataGridProps {
	params: DataParams;
	columns: DataColumn[];
	totalRows: number;
	selection: GridSelection | null;
	onSelectionChange: (selection: GridSelection | null) => void;
	/** Column widths in px; owned by the viewer so they survive tab switches. */
	widths: number[];
	onResize: (column: number, width: number) => void;
	onSort: (column: number) => void;
	/** Tab-separated by default; the context menu can ask for CSV and/or a header row. */
	onCopy: (range: CellRange, options?: CopyOptions) => void;
	/** Written with the first visible row so "Copy as CSV" can export the current page. */
	firstRowRef: RefObject<number>;
}

/** Horizontal overscan so fast sideways scrolling doesn't reveal blank columns. */
const COLUMN_OVERSCAN_PX = 240;

export function DataGrid({
	params,
	columns,
	totalRows,
	selection,
	onSelectionChange,
	widths,
	onResize,
	onSort,
	onCopy,
	firstRowRef,
}: DataGridProps): JSX.Element {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scroll, setScroll] = useState({ top: 0, left: 0 });
	const [size, setSize] = useState({ width: 0, height: 0 });

	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const measure = (): void => setSize({ width: el.clientWidth, height: el.clientHeight });
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// A new filter or sort produces a different row set: start again from the top.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [params.filter, params.sort]);

	const gutter = gutterWidth(totalRows);
	const offsets = useMemo(() => columnOffsets(widths), [widths]);
	const contentWidth = gutter + (offsets[offsets.length - 1] ?? 0);
	const viewportHeight = Math.max(0, size.height - HEADER_HEIGHT);
	const win = computeWindow(scroll.top, viewportHeight, totalRows);
	const cols = visibleColumns(
		offsets,
		scroll.left - COLUMN_OVERSCAN_PX,
		scroll.left + size.width - gutter + COLUMN_OVERSCAN_PX,
	);
	const getRow = useRowPages(params, win.start, win.end, size.height > 0);
	const range = selection ? selectionRange(selection) : null;
	const firstVisible = Math.min(
		Math.max(0, totalRows - 1),
		Math.floor((scroll.top * win.ratio) / ROW_HEIGHT),
	);

	useEffect(() => {
		firstRowRef.current = firstVisible;
	}, [firstRowRef, firstVisible]);

	const reveal = (pos: CellPos): void => {
		const el = scrollRef.current;
		if (!el) return;
		const top = scrollTopForRow(pos.row, el.scrollTop, viewportHeight, totalRows);
		const colLeft = offsets[pos.col] ?? 0;
		const colRight = offsets[pos.col + 1] ?? 0;
		const visibleWidth = el.clientWidth - gutter;
		let left = el.scrollLeft;
		if (colLeft < left) left = colLeft;
		else if (colRight > left + visibleWidth) left = colRight - visibleWidth;
		el.scrollTo({ top, left });
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		const ctrl = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();
		if (ctrl && key === 'c') {
			if (range) onCopy(range);
			event.preventDefault();
			return;
		}
		if (ctrl && key === 'a') {
			event.preventDefault();
			onSelectionChange({
				anchor: { row: 0, col: 0 },
				focus: { row: totalRows - 1, col: columns.length - 1 },
			});
			return;
		}
		if (event.key === 'Escape' && selection) {
			onSelectionChange(null);
			return;
		}
		const pageRows = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT) - 1);
		const next = moveSelection(
			selection,
			{ key: event.key, shiftKey: event.shiftKey, ctrlKey: ctrl },
			{ rows: totalRows, cols: columns.length, pageRows },
		);
		if (!next) return;
		event.preventDefault();
		onSelectionChange(next);
		reveal(next.focus);
	};

	const mouse = useGridMouse({
		selection,
		columnCount: columns.length,
		onSelectionChange,
		focusGrid: () => scrollRef.current?.focus({ preventScroll: true }),
	});

	const rows: JSX.Element[] = [];
	for (let r = win.start; r < win.end; r++) {
		const inRange = range !== null && r >= range.top && r <= range.bottom;
		rows.push(
			<GridRow
				key={r}
				index={r}
				top={HEADER_HEIGHT + win.top + (r - win.start) * ROW_HEIGHT}
				cells={getRow(r)}
				columns={columns}
				offsets={offsets}
				gutter={gutter}
				width={contentWidth}
				colStart={cols.start}
				colEnd={cols.end}
				selLeft={inRange ? range.left : -1}
				selRight={inRange ? range.right : -1}
			/>,
		);
	}

	let overlay: JSX.Element | null = null;
	if (range) {
		const r0 = Math.max(range.top, win.start);
		const r1 = Math.min(range.bottom, win.end - 1);
		if (r0 <= r1) {
			overlay = (
				<div
					aria-hidden
					className='pointer-events-none absolute z-5 border border-accent shadow-glow'
					style={{
						top: HEADER_HEIGHT + win.top + (r0 - win.start) * ROW_HEIGHT,
						height: (r1 - r0 + 1) * ROW_HEIGHT,
						left: gutter + (offsets[range.left] ?? 0),
						width: (offsets[range.right + 1] ?? 0) - (offsets[range.left] ?? 0),
					}}
				/>
			);
		}
	}

	// In a multi-cell range, mark the focus cell (the corner Shift+Arrow moves) as spreadsheets do.
	let focusMark: JSX.Element | null = null;
	const focus = selection?.focus;
	if (
		range &&
		focus &&
		(range.top !== range.bottom || range.left !== range.right) &&
		focus.row >= win.start &&
		focus.row < win.end
	) {
		focusMark = (
			<div
				aria-hidden
				className='pointer-events-none absolute z-5 border border-accent bg-accent-soft'
				style={{
					top: HEADER_HEIGHT + win.top + (focus.row - win.start) * ROW_HEIGHT,
					height: ROW_HEIGHT,
					left: gutter + (offsets[focus.col] ?? 0),
					width: (offsets[focus.col + 1] ?? 0) - (offsets[focus.col] ?? 0),
				}}
			/>
		);
	}

	return (
		<AppContextMenu
			items={gridMenuItems(range, totalRows, columns.length, onCopy, onSelectionChange)}
		>
			<div
				ref={scrollRef}
				role='grid'
				aria-rowcount={totalRows + 1}
				aria-colcount={columns.length}
				aria-multiselectable
				aria-label='Data table'
				tabIndex={0}
				onScroll={(e) =>
					setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })
				}
				onKeyDown={onKeyDown}
				onMouseDown={mouse.onMouseDown}
				onMouseMove={mouse.onMouseMove}
				onMouseUp={mouse.onMouseUp}
				className='relative min-h-0 flex-1 overflow-auto focus-visible:-outline-offset-1'
			>
				<div
					className='relative'
					style={{ width: contentWidth, height: HEADER_HEIGHT + win.height }}
				>
					<GridHeader
						columns={columns}
						offsets={offsets}
						gutter={gutter}
						width={contentWidth}
						colStart={cols.start}
						colEnd={cols.end}
						sort={params.sort}
						selLeft={range ? range.left : -1}
						selRight={range ? range.right : -1}
						onSort={onSort}
						onResize={onResize}
					/>
					{rows}
					{overlay}
					{focusMark}
				</div>
			</div>
		</AppContextMenu>
	);
}
