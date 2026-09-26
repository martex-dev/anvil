import { z } from 'zod';

import { defineChannels } from '../define';

export const DataFormatSchema = z.enum([
	'csv',
	'tsv',
	'json',
	'jsonl',
	'parquet',
	'feather',
	'xlsx',
]);
export type DataFormat = z.infer<typeof DataFormatSchema>;

export const ColumnTypeSchema = z.enum(['int', 'float', 'bool', 'date', 'string', 'empty']);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

export const DataColumnSchema = z.object({ name: z.string(), type: ColumnTypeSchema });
export type DataColumn = z.infer<typeof DataColumnSchema>;

export const DataPageSchema = z.object({
	format: DataFormatSchema,
	columns: z.array(DataColumnSchema),
	/** Cells as text; null = missing. */
	rows: z.array(z.array(z.string().nullable())),
	/** Rows after filtering. */
	totalRows: z.number().int(),
	/** Rows in the loaded table before filtering (all of them unless truncated). */
	loadedRows: z.number().int(),
	/** Only the first rows of a very large file were loaded. */
	truncated: z.boolean(),
	/** Which engine read it: built-in, or the selected Python env (polars / pandas). */
	engine: z.string(),
});
export type DataPage = z.infer<typeof DataPageSchema>;

export const ColumnStatsSchema = z.object({
	count: z.number().int(),
	nulls: z.number().int(),
	unique: z.number().int(),
	min: z.string().nullable(),
	max: z.string().nullable(),
	mean: z.number().nullable(),
	std: z.number().nullable(),
	/** 20 equal-width bins over [min, max] for numeric columns; top values otherwise. */
	histogram: z.array(z.object({ label: z.string(), count: z.number().int() })),
});
export type ColumnStats = z.infer<typeof ColumnStatsSchema>;

export const DataQuerySchema = z.object({
	path: z.string().min(1).max(4096),
	offset: z.number().int().min(0),
	limit: z.number().int().min(1).max(2000),
	sort: z.object({ column: z.number().int().min(0), desc: z.boolean() }).nullable(),
	/** Case-insensitive substring over every cell. */
	filter: z.string().max(500),
});
export type DataQuery = z.infer<typeof DataQuerySchema>;

export const dataChannels = defineChannels({
	'data:page': { input: DataQuerySchema, output: DataPageSchema },
	'data:stats': {
		input: z.object({ path: z.string().min(1).max(4096), column: z.number().int().min(0) }),
		output: ColumnStatsSchema,
	},
	/** Drops a file from the cache (it changed on disk). */
	'data:evict': { input: z.string().min(1).max(4096), output: z.void() },
});
