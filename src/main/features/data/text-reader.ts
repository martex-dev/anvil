import { open } from 'node:fs/promises';

import { AnvilError } from '../../core/errors';
import type { TextFormat } from './format';
import { buildTable, parseDelimited, sniffDelimiter, type Table, tableFromRecords } from './table';

/** Text formats load at most this much; beyond it only the head of the file is shown. */
export const MAX_TEXT_BYTES = 200 * 1024 * 1024;
export const MAX_ROWS = 1_000_000;

export async function readHead(
	abs: string,
	size: number,
	maxBytes = MAX_TEXT_BYTES,
): Promise<{ text: string; truncated: boolean }> {
	const bytes = Math.min(size, maxBytes);
	const handle = await open(abs, 'r');
	try {
		const buf = Buffer.alloc(bytes);
		await handle.read(buf, 0, bytes, 0);
		return { text: buf.toString('utf8'), truncated: size > bytes };
	} finally {
		await handle.close();
	}
}

/** Parses CSV/TSV/JSON/JSONL text (possibly only the head of the file) into a table. */
export function tableFromText(
	text: string,
	format: TextFormat,
	truncated: boolean,
	maxRows = MAX_ROWS,
): Table {
	if (format === 'csv' || format === 'tsv') {
		const delimiter = format === 'tsv' ? '\t' : sniffDelimiter(text.slice(0, 4096));
		const parsed = parseDelimited(text, delimiter, maxRows);
		return buildTable(parsed.header, parsed.rows, truncated || parsed.truncated, 'built-in');
	}
	let records: unknown[];
	try {
		if (format === 'jsonl') {
			const lines = text.split(/\r?\n/).filter((l) => l.trim());
			// The last line of a cut-off file is usually partial.
			if (truncated) lines.pop();
			records = lines.slice(0, maxRows).map((l) => JSON.parse(l) as unknown);
		} else {
			if (truncated)
				throw new AnvilError('DATA_TOO_LARGE', 'JSON files over 200 MB are not supported');
			const parsed = JSON.parse(text) as unknown;
			records = Array.isArray(parsed) ? parsed : [parsed];
		}
	} catch (error) {
		if (error instanceof AnvilError) throw error;
		throw new AnvilError('DATA_PARSE', `Invalid JSON: ${(error as Error).message}`);
	}
	return tableFromRecords(records, truncated || records.length >= maxRows);
}
