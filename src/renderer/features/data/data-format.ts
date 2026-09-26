import type { ColumnType, DataColumn, DataFormat } from '@shared/ipc/channels/data';

export const PAGE_SIZE = 500;
export const ROW_HEIGHT = 24;
export const HEADER_HEIGHT = 30;
export const MIN_COLUMN_WIDTH = 48;
/**
 * Chromium caps element heights near 33.5M px, so a 1M+ row spacer would silently clip.
 * Past this height the scrollbar maps proportionally onto the virtual rows instead.
 */
export const MAX_SCROLL_PX = 15_000_000;

export interface SortState {
	column: number;
	desc: boolean;
}

const TYPE_TAGS: Record<ColumnType, string> = {
	int: 'INT',
	float: 'FLT',
	bool: 'BOOL',
	date: 'DATE',
	string: 'STR',
	empty: 'NULL',
};

const TEXT_FORMATS: ReadonlySet<DataFormat> = new Set(['csv', 'tsv', 'json', 'jsonl']);

/** Formats that are readable text, so "Open as text" makes sense. */
export function isTextFormat(format: DataFormat): boolean {
	return TEXT_FORMATS.has(format);
}

export function typeTag(type: ColumnType): string {
	return TYPE_TAGS[type];
}

export function isNumericType(type: ColumnType): boolean {
	return type === 'int' || type === 'float';
}

export function isNegative(value: string): boolean {
	return value.startsWith('-') && value.length > 1;
}

/** Header width from the name and type; numbers and dates need room for their widest values. */
export function initialColumnWidth(column: DataColumn): number {
	const fromName = Math.round(column.name.length * 7.2) + 52;
	const floor =
		column.type === 'date'
			? 150
			: isNumericType(column.type)
				? 96
				: column.type === 'bool'
					? 72
					: 110;
	return Math.min(320, Math.max(floor, fromName));
}

/** Row-number gutter wide enough for the largest row number. */
export function gutterWidth(totalRows: number): number {
	return Math.max(44, String(Math.max(1, totalRows)).length * 7.5 + 20);
}

const countFormat = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
	return countFormat.format(value);
}

const statFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });

/** Stats values: grouped and trimmed, scientific when tiny or astronomically large. */
export function formatStat(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return '—';
	if (value === 0) return '0';
	const abs = Math.abs(value);
	if (abs < 1e-4 || abs >= 1e15) return value.toExponential(3);
	return statFormat.format(value);
}

/** min/max arrive as text; numeric columns get the same formatting as mean/std. */
export function formatStatText(value: string | null, numeric: boolean): string {
	if (value === null || value === '') return '—';
	if (!numeric) return value;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? formatStat(parsed) : value;
}

/** What the column profile covers: stats see every loaded row, which for a big file is the head. */
export function profileScope(truncated: boolean, loadedRows: number): string {
	return truncated
		? `Computed over the first ${formatCount(loadedRows)} rows (all that was loaded), ignoring the filter.`
		: 'Computed over the whole file, ignoring the filter.';
}

/** Header click cycle: ascending → descending → unsorted. */
export function nextSort(current: SortState | null, column: number): SortState | null {
	if (!current || current.column !== column) return { column, desc: false };
	if (!current.desc) return { column, desc: true };
	return null;
}

export function fileName(path: string): string {
	const parts = path.split(/[\\/]/);
	return parts[parts.length - 1] || path;
}

function quoteField(value: string | null, sep: string): string {
	if (value === null) return '';
	if (value.includes(sep) || /["\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
	return value;
}

/** RFC 4180-style text; nulls become empty fields. Used for both CSV and clipboard TSV. */
export function toDelimited(
	rows: ReadonlyArray<ReadonlyArray<string | null>>,
	sep: ',' | '\t',
): string {
	return rows.map((row) => row.map((cell) => quoteField(cell, sep)).join(sep)).join('\r\n');
}

export interface GridWindow {
	/** First rendered row (includes overscan). */
	start: number;
	/** One past the last rendered row. */
	end: number;
	/** Real px offset (below the header) of row `start`. */
	top: number;
	/** Real px height of the scrollable body. */
	height: number;
	/** Virtual px per real scroll px; 1 unless the table is taller than MAX_SCROLL_PX. */
	ratio: number;
}

export function computeWindow(
	scrollTop: number,
	viewportHeight: number,
	totalRows: number,
	overscan = 8,
	rowHeight = ROW_HEIGHT,
): GridWindow {
	const virtualHeight = totalRows * rowHeight;
	const height = Math.min(virtualHeight, MAX_SCROLL_PX);
	const maxReal = Math.max(0, height - viewportHeight);
	const maxVirtual = Math.max(0, virtualHeight - viewportHeight);
	const ratio = maxReal > 0 ? maxVirtual / maxReal : 1;
	const clamped = Math.min(Math.max(0, scrollTop), maxReal);
	const virtualTop = clamped * ratio;
	const start = Math.max(0, Math.floor(virtualTop / rowHeight) - overscan);
	const end = Math.min(
		totalRows,
		Math.ceil((virtualTop + viewportHeight) / rowHeight) + overscan,
	);
	return { start, end, top: clamped - (virtualTop - start * rowHeight), height, ratio };
}

/** Smallest scroll change that brings `row` fully into view. */
export function scrollTopForRow(
	row: number,
	scrollTop: number,
	viewportHeight: number,
	totalRows: number,
	rowHeight = ROW_HEIGHT,
): number {
	const { ratio } = computeWindow(scrollTop, viewportHeight, totalRows, 0, rowHeight);
	const virtualTop = scrollTop * ratio;
	const rowTop = row * rowHeight;
	if (rowTop < virtualTop) return Math.floor(rowTop / ratio);
	if (rowTop + rowHeight > virtualTop + viewportHeight) {
		return Math.ceil((rowTop + rowHeight - viewportHeight) / ratio);
	}
	return scrollTop;
}

/** Prefix sums: offsets[i] is the left edge of column i, offsets[n] the total width. */
export function columnOffsets(widths: readonly number[]): number[] {
	const offsets = [0];
	let sum = 0;
	for (const width of widths) {
		sum += width;
		offsets.push(sum);
	}
	return offsets;
}

/** Columns intersecting [left, right) in content px, as [start, end). */
export function visibleColumns(
	offsets: readonly number[],
	left: number,
	right: number,
): { start: number; end: number } {
	const count = offsets.length - 1;
	let start = 0;
	while (start < count && (offsets[start + 1] ?? 0) <= left) start++;
	let end = start;
	while (end < count && (offsets[end] ?? 0) < right) end++;
	return { start, end };
}

/** Page indexes covering rows [start, end). */
export function pagesForRange(start: number, end: number, pageSize = PAGE_SIZE): number[] {
	if (end <= start) return [];
	const pages: number[] = [];
	for (let p = Math.floor(start / pageSize); p <= Math.floor((end - 1) / pageSize); p++) {
		pages.push(p);
	}
	return pages;
}
