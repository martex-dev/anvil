import { stat } from 'node:fs/promises';

import type { ColumnStats, DataFormat, DataPage, DataQuery } from '@shared/ipc/channels/data';

import { AnvilError } from '../../core/errors';
import { isTextFormat } from './format';
import { readWithPython } from './python-reader';
import { columnStats, type Table, view } from './table';
import { readHead, tableFromText } from './text-reader';

const PYTHON_ROWS = 250_000;
const CACHE_SIZE = 3;

/** Everything the store needs to read one file; resolved in the main thread. */
export interface LoadSpec {
	abs: string;
	/** Workspace-relative path, for error messages (never show the absolute path). */
	rel: string;
	format: DataFormat;
	/** The interpreter (and its activated env) for the Python-read formats. */
	python: { path: string; env: NodeJS.ProcessEnv } | null;
}

export type PageQuery = Omit<DataQuery, 'path'>;

interface Cached {
	mtimeMs: number;
	table: Table;
	format: DataFormat;
	/** Last filter/sort result, reused while scrolling. */
	view: { key: string; idx: number[] } | null;
}

/**
 * Parsed tables, a small LRU keyed by absolute path. Runs in the data worker thread: parsing,
 * filtering and sorting a million rows would otherwise freeze the whole app.
 */
export class DataStore {
	private readonly cache = new Map<string, Cached>();
	/** Loads in progress, keyed by path and mtime, shared by concurrent requests. */
	private readonly loading = new Map<string, Promise<Cached>>();
	/** Bumped by clear() so loads that were already running don't refill the cache. */
	private generation = 0;

	async page(spec: LoadSpec, query: PageQuery): Promise<DataPage> {
		const entry = await this.load(spec);
		const key = JSON.stringify([query.filter, query.sort]);
		if (entry.view?.key !== key) {
			entry.view = { key, idx: view(entry.table, query.filter, query.sort) };
		}
		const idx = entry.view.idx;
		return {
			format: entry.format,
			columns: entry.table.columns,
			rows: idx
				.slice(query.offset, query.offset + query.limit)
				.map((i) => entry.table.rows[i] ?? []),
			totalRows: idx.length,
			truncated: entry.table.truncated,
			engine: entry.table.engine,
		};
	}

	async stats(spec: LoadSpec, column: number): Promise<ColumnStats> {
		return columnStats((await this.load(spec)).table, column);
	}

	evict(abs: string): void {
		this.cache.delete(abs);
	}

	clear(): void {
		this.generation++;
		this.cache.clear();
	}

	private async load(spec: LoadSpec): Promise<Cached> {
		const { abs } = spec;
		const s = await stat(abs);
		const hit = this.cache.get(abs);
		if (hit && hit.mtimeMs === s.mtimeMs) {
			// LRU: move to the back.
			this.cache.delete(abs);
			this.cache.set(abs, hit);
			return hit;
		}
		// The viewer asks for several pages and the stats at once: parse the file only once.
		const key = `${abs}\0${s.mtimeMs}`;
		const inFlight = this.loading.get(key);
		if (inFlight) return inFlight;
		const pending = this.read(spec, s.mtimeMs, s.size).finally(() => {
			if (this.loading.get(key) === pending) this.loading.delete(key);
		});
		this.loading.set(key, pending);
		return pending;
	}

	private async read(spec: LoadSpec, mtimeMs: number, size: number): Promise<Cached> {
		const { abs, format } = spec;
		const generation = this.generation;
		let table: Table;
		if (isTextFormat(format)) {
			const { text, truncated } = await readHead(abs, size);
			table = tableFromText(text, format, truncated);
		} else {
			if (!spec.python)
				throw new AnvilError(
					'DATA_NO_PYTHON',
					`${format} files are read with Python (polars or pandas). Select an interpreter first.`,
				);
			table = await readWithPython(spec.python.path, spec.python.env, abs, PYTHON_ROWS);
		}
		const entry: Cached = { mtimeMs, table, format, view: null };
		// A folder switch cleared the cache while this was loading: don't bring it back.
		if (generation !== this.generation) return entry;
		this.cache.set(abs, entry);
		while (this.cache.size > CACHE_SIZE) {
			const oldest = this.cache.keys().next();
			if (oldest.done) break;
			this.cache.delete(oldest.value);
		}
		return entry;
	}
}
