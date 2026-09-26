import { open, stat } from 'node:fs/promises';
import { extname } from 'node:path';

import type { DataFormat } from '@shared/ipc/channels/data';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { toAbsolute } from '../../core/workspace/fs-guard';
import { interpreter } from '../python/interpreter';
import { readWithPython } from './python-reader';
import {
	buildTable,
	columnStats,
	parseDelimited,
	sniffDelimiter,
	type Table,
	tableFromRecords,
	view,
} from './table';

/** Text formats load at most this much; beyond it only the head of the file is shown. */
const MAX_TEXT_BYTES = 200 * 1024 * 1024;
const MAX_ROWS = 1_000_000;
const PYTHON_ROWS = 250_000;
const CACHE_SIZE = 3;

export function formatOf(path: string): DataFormat | null {
	const ext = extname(path).toLowerCase().slice(1);
	switch (ext) {
		case 'csv':
		case 'tsv':
		case 'json':
		case 'jsonl':
		case 'parquet':
		case 'feather':
		case 'xlsx':
			return ext;
		case 'ndjson':
			return 'jsonl';
		case 'arrow':
		case 'ipc':
			return 'feather';
		case 'tab':
		case 'txt':
			return 'tsv';
		default:
			return null;
	}
}

async function readHead(abs: string, size: number): Promise<{ text: string; truncated: boolean }> {
	const bytes = Math.min(size, MAX_TEXT_BYTES);
	const handle = await open(abs, 'r');
	try {
		const buf = Buffer.alloc(bytes);
		await handle.read(buf, 0, bytes, 0);
		return { text: buf.toString('utf8'), truncated: size > bytes };
	} finally {
		await handle.close();
	}
}

interface Cached {
	mtimeMs: number;
	table: Table;
	format: DataFormat;
	/** Last filter/sort result, reused while scrolling. */
	view: { key: string; idx: number[] } | null;
}

export const dataFeature: MainFeature = {
	id: 'data',
	activate(ctx) {
		const cache = new Map<string, Cached>();
		ctx.workspace.onChange(() => cache.clear());

		const load = async (rel: string): Promise<Cached> => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('NO_WORKSPACE', 'No folder is open');
			const abs = toAbsolute(root, rel);
			const format = formatOf(abs);
			if (!format) throw new AnvilError('DATA_FORMAT', 'Not a data file Anvil can show');
			const s = await stat(abs);
			const hit = cache.get(abs);
			if (hit && hit.mtimeMs === s.mtimeMs) {
				// LRU: move to the back.
				cache.delete(abs);
				cache.set(abs, hit);
				return hit;
			}
			let table: Table;
			if (format === 'parquet' || format === 'feather' || format === 'xlsx') {
				const python = interpreter.resolve(root);
				if (!python)
					throw new AnvilError(
						'DATA_NO_PYTHON',
						`${format} files are read with Python (polars or pandas). Select an interpreter first.`,
					);
				table = await readWithPython(python, abs, PYTHON_ROWS);
			} else {
				const { text, truncated } = await readHead(abs, s.size);
				if (format === 'json' || format === 'jsonl') {
					let records: unknown[];
					try {
						if (format === 'jsonl') {
							const lines = text.split(/\r?\n/).filter((l) => l.trim());
							// The last line of a cut-off file is usually partial.
							if (truncated) lines.pop();
							records = lines.slice(0, MAX_ROWS).map((l) => JSON.parse(l) as unknown);
						} else {
							if (truncated)
								throw new AnvilError(
									'DATA_TOO_LARGE',
									'JSON files over 200 MB are not supported',
								);
							const parsed = JSON.parse(text) as unknown;
							records = Array.isArray(parsed) ? parsed : [parsed];
						}
					} catch (error) {
						if (error instanceof AnvilError) throw error;
						throw new AnvilError(
							'DATA_PARSE',
							`Invalid JSON: ${(error as Error).message}`,
						);
					}
					table = tableFromRecords(records, truncated || records.length >= MAX_ROWS);
				} else {
					const delimiter = format === 'tsv' ? '\t' : sniffDelimiter(text.slice(0, 4096));
					const parsed = parseDelimited(text, delimiter, MAX_ROWS);
					table = buildTable(
						parsed.header,
						parsed.rows,
						truncated || parsed.truncated,
						'built-in',
					);
				}
			}
			const entry: Cached = { mtimeMs: s.mtimeMs, table, format, view: null };
			cache.set(abs, entry);
			while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
			return entry;
		};

		ctx.ipc.handle('data:page', async ({ path, offset, limit, sort, filter }) => {
			const entry = await load(path);
			const key = JSON.stringify([filter, sort]);
			if (entry.view?.key !== key) entry.view = { key, idx: view(entry.table, filter, sort) };
			const idx = entry.view.idx;
			return {
				format: entry.format,
				columns: entry.table.columns,
				rows: idx.slice(offset, offset + limit).map((i) => entry.table.rows[i] ?? []),
				totalRows: idx.length,
				truncated: entry.table.truncated,
				engine: entry.table.engine,
			};
		});
		ctx.ipc.handle('data:stats', async ({ path, column }) =>
			columnStats((await load(path)).table, column),
		);
		ctx.ipc.handle('data:evict', (path) => {
			const root = ctx.workspace.root();
			if (root) cache.delete(toAbsolute(root, path));
		});
	},
};
