import type { ColumnStats, ColumnType, DataColumn } from '@shared/ipc/channels/data';

export type Cell = string | null;

export interface Table {
	columns: DataColumn[];
	rows: Cell[][];
	truncated: boolean;
	engine: string;
}

/**
 * RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes, CRLF. Stops after
 * `maxRows` data rows. Empty unquoted fields become null (missing).
 */
export function parseDelimited(
	text: string,
	delimiter: string,
	maxRows: number,
): { header: string[]; rows: Cell[][]; truncated: boolean } {
	const records: Cell[][] = [];
	let field = '';
	let quoted = false;
	let wasQuoted = false;
	let record: Cell[] = [];
	let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
	let truncated = false;
	const endField = (): void => {
		record.push(field === '' && !wasQuoted ? null : field);
		field = '';
		wasQuoted = false;
	};
	const endRecord = (): boolean => {
		endField();
		if (!(record.length === 1 && record[0] === null)) records.push(record);
		record = [];
		if (records.length > maxRows) {
			truncated = true;
			return false;
		}
		return true;
	};
	for (; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else quoted = false;
			} else field += ch;
			continue;
		}
		if (ch === '"' && field === '') {
			quoted = true;
			wasQuoted = true;
		} else if (ch === delimiter) endField();
		else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && text[i + 1] === '\n') i++;
			if (!endRecord()) break;
		} else field += ch;
	}
	if (!truncated && (field !== '' || record.length > 0)) endRecord();
	const [head = [], ...rows] = records;
	const width = Math.max(head.length, ...rows.slice(0, 1000).map((r) => r.length));
	const header = Array.from({ length: width }, (_, c) => {
		const name = head[c];
		return name === null || name === undefined || name === '' ? `column_${c + 1}` : name;
	});
	return { header, rows: rows.slice(0, maxRows), truncated };
}

/** `;` is common in European CSV exports (Excel with a decimal comma). */
export function sniffDelimiter(sample: string): string {
	const line = sample.split(/\r?\n/, 1)[0] ?? '';
	const counts = [',', ';', '\t', '|'].map((d) => [d, line.split(d).length - 1] as const);
	counts.sort((a, b) => b[1] - a[1]);
	return counts[0] && counts[0][1] > 0 ? counts[0][0] : ',';
}

const INT = /^[+-]?\d+$/;
const FLOAT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$|^[+-]?(?:inf|nan)$/i;
const BOOL = /^(?:true|false)$/i;
const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function inferType(values: Iterable<Cell>, limit = 1000): ColumnType {
	let seen = 0;
	let int = true;
	let float = true;
	let bool = true;
	let date = true;
	for (const v of values) {
		if (v === null || v === '') continue;
		if (++seen > limit) break;
		if (int && !INT.test(v)) int = false;
		if (float && !FLOAT.test(v)) float = false;
		if (bool && !BOOL.test(v)) bool = false;
		if (date && !DATE.test(v)) date = false;
		if (!int && !float && !bool && !date) return 'string';
	}
	if (seen === 0) return 'empty';
	if (int) return 'int';
	if (float) return 'float';
	if (bool) return 'bool';
	return date ? 'date' : 'string';
}

function* column(rows: Cell[][], c: number): Generator<Cell> {
	for (const r of rows) yield r[c] ?? null;
}

export function buildTable(
	header: string[],
	rows: Cell[][],
	truncated: boolean,
	engine: string,
): Table {
	return {
		columns: header.map((name, c) => ({ name, type: inferType(column(rows, c)) })),
		rows,
		truncated,
		engine,
	};
}

/** Array of objects (or JSON Lines): the union of the first rows' keys become columns. */
export function tableFromRecords(records: unknown[], truncated: boolean): Table {
	const keys: string[] = [];
	for (const r of records.slice(0, 1000)) {
		if (r && typeof r === 'object' && !Array.isArray(r)) {
			for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
		}
	}
	const scalar = keys.length === 0;
	const header = scalar ? ['value'] : keys;
	const cell = (v: unknown): Cell =>
		v === null || v === undefined
			? null
			: typeof v === 'object'
				? JSON.stringify(v)
				: String(v);
	const rows = records.map((r) =>
		scalar
			? [cell(r)]
			: keys.map((k) =>
					cell(
						r && typeof r === 'object' ? (r as Record<string, unknown>)[k] : undefined,
					),
				),
	);
	return buildTable(header, rows, truncated, 'built-in');
}

const NUMERIC: ReadonlySet<ColumnType> = new Set(['int', 'float']);

/** Row indices after filtering and sorting (numbers compare numerically, missing last). */
export function view(
	table: Table,
	filter: string,
	sort: { column: number; desc: boolean } | null,
): number[] {
	const needle = filter.trim().toLowerCase();
	let idx = table.rows.map((_, i) => i);
	if (needle) {
		idx = idx.filter((i) =>
			(table.rows[i] ?? []).some((v) => v !== null && v.toLowerCase().includes(needle)),
		);
	}
	if (sort) {
		const numeric = NUMERIC.has(table.columns[sort.column]?.type ?? 'string');
		const dir = sort.desc ? -1 : 1;
		const key = (i: number): Cell => table.rows[i]?.[sort.column] ?? null;
		// A Collator is much faster than localeCompare over a million rows (same ordering).
		const collator = new Intl.Collator(undefined, { numeric: true });
		idx.sort((a, b) => {
			const x = key(a);
			const y = key(b);
			if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
			if (numeric) return (Number(x) - Number(y)) * dir;
			return collator.compare(x, y) * dir;
		});
	}
	return idx;
}

export function columnStats(table: Table, c: number): ColumnStats {
	const type = table.columns[c]?.type ?? 'string';
	const values: string[] = [];
	let nulls = 0;
	for (const r of table.rows) {
		const v = r[c] ?? null;
		if (v === null || v === '') nulls++;
		else values.push(v);
	}
	const unique = new Set(values).size;
	if (NUMERIC.has(type)) {
		const nums = values.map(Number).filter((n) => Number.isFinite(n));
		if (nums.length === 0) {
			return {
				count: values.length,
				nulls,
				unique,
				min: null,
				max: null,
				mean: null,
				std: null,
				histogram: [],
			};
		}
		let min = Infinity;
		let max = -Infinity;
		let sum = 0;
		for (const n of nums) {
			if (n < min) min = n;
			if (n > max) max = n;
			sum += n;
		}
		const mean = sum / nums.length;
		const variance =
			nums.length > 1 ? nums.reduce((s, n) => s + (n - mean) ** 2, 0) / (nums.length - 1) : 0;
		const bins = 20;
		const width = (max - min) / bins || 1;
		const counts = new Array<number>(bins).fill(0);
		for (const n of nums) {
			const bin = Math.min(bins - 1, Math.floor((n - min) / width));
			counts[bin] = (counts[bin] ?? 0) + 1;
		}
		const fmt = (n: number): string =>
			Math.abs(n) >= 1e5 || (n !== 0 && Math.abs(n) < 1e-3)
				? n.toExponential(2)
				: String(Math.round(n * 1000) / 1000);
		return {
			count: values.length,
			nulls,
			unique,
			min: String(min),
			max: String(max),
			mean,
			std: Math.sqrt(variance),
			histogram: counts.map((count, i) => ({ label: fmt(min + i * width), count })),
		};
	}
	const freq = new Map<string, number>();
	for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
	const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
	// One linear pass: sorting a copy of a million strings just for min/max is far slower.
	const collator = new Intl.Collator(undefined, { numeric: true });
	let min: string | null = null;
	let max: string | null = null;
	for (const v of values) {
		if (min === null || collator.compare(v, min) < 0) min = v;
		if (max === null || collator.compare(v, max) > 0) max = v;
	}
	return {
		count: values.length,
		nulls,
		unique,
		min,
		max,
		mean: null,
		std: null,
		histogram: top.map(([label, count]) => ({ label, count })),
	};
}
