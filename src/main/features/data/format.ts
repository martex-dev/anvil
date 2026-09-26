import { extname } from 'node:path';

import type { DataFormat } from '@shared/ipc/channels/data';

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

export type TextFormat = Extract<DataFormat, 'csv' | 'tsv' | 'json' | 'jsonl'>;

/** Columnar formats need a real Arrow implementation, so they go through the user's Python. */
export function isTextFormat(format: DataFormat): format is TextFormat {
	return format === 'csv' || format === 'tsv' || format === 'json' || format === 'jsonl';
}
