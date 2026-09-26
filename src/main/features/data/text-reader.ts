import { open } from 'node:fs/promises';

import { AnvilError, errorMessage } from '../../core/errors';
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

/** One JSON value per line; blank lines are skipped, errors name the file's line number. */
function parseJsonLines(
	text: string,
	truncated: boolean,
	maxRows: number,
): { records: unknown[]; more: boolean } {
	const lines = text.split(/\r?\n/);
	// The last line of a cut-off file is usually partial.
	if (truncated) lines.pop();
	const records: unknown[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		if (!line.trim()) continue;
		if (records.length === maxRows) return { records, more: true };
		try {
			records.push(JSON.parse(line) as unknown);
		} catch (error) {
			throw new AnvilError(
				'DATA_PARSE',
				`Invalid JSON on line ${i + 1}: ${errorMessage(error)}`,
				error,
			);
		}
	}
	return { records, more: false };
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
		// Only the head of the file was read: its last record is usually cut off mid-row.
		const whole = truncated ? text.slice(0, text.lastIndexOf('\n') + 1) : text;
		const parsed = parseDelimited(whole, delimiter, maxRows);
		return buildTable(parsed.header, parsed.rows, truncated || parsed.truncated, 'built-in');
	}
	let records: unknown[];
	let more = false;
	if (format === 'jsonl') {
		({ records, more } = parseJsonLines(text, truncated, maxRows));
	} else {
		if (truncated)
			throw new AnvilError('DATA_TOO_LARGE', 'JSON files over 200 MB are not supported');
		let parsed: unknown;
		try {
			parsed = JSON.parse(text) as unknown;
		} catch (error) {
			throw new AnvilError('DATA_PARSE', `Invalid JSON: ${errorMessage(error)}`, error);
		}
		records = Array.isArray(parsed) ? parsed : [parsed];
		more = records.length > maxRows;
		if (more) records = records.slice(0, maxRows);
	}
	return tableFromRecords(records, truncated || more);
}
