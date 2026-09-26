import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import type { DataColumn } from '@shared/ipc/channels/data';

import { toast } from '../../stores/toast-store';
import { formatCount, PAGE_SIZE, toDelimited } from './data-format';
import type { CellRange, CopyOptions } from './grid-selection';
import { type DataParams, fetchRows } from './use-data-pages';

/** Clipboard exports beyond this would stall the UI and rarely paste anywhere useful. */
const MAX_COPY_ROWS = 50_000;
/** Copies spanning more pages than this may take a while, so they say they have started. */
const SLOW_COPY_PAGES = 4;

interface TableCopy {
	/** A copy is fetching rows; further copies are ignored until it finishes. */
	copying: boolean;
	copy: (range: CellRange, options?: CopyOptions) => void;
}

/** Copies a cell range to the clipboard, fetching any rows that aren't loaded yet. */
export function useTableCopy(params: DataParams, columns: DataColumn[]): TableCopy {
	const client = useQueryClient();
	const [copying, setCopying] = useState(false);
	// State updates land on the next render; the ref also stops two copies in the same tick.
	const busy = useRef(false);

	const run = async (
		range: CellRange,
		{ csv = false, header = false }: CopyOptions,
	): Promise<void> => {
		const bottom = Math.min(range.bottom, range.top + MAX_COPY_ROWS - 1);
		const rowCount = bottom - range.top + 1;
		if (rowCount > SLOW_COPY_PAGES * PAGE_SIZE)
			toast.info(`Copying ${formatCount(rowCount)} rows…`);
		try {
			const rows = await fetchRows(client, params, range.top, bottom);
			const body = rows.map((row) => row.slice(range.left, range.right + 1));
			const names = columns.slice(range.left, range.right + 1).map((c) => c.name);
			await navigator.clipboard.writeText(
				toDelimited(header ? [names, ...body] : body, csv ? ',' : '\t'),
			);
			const what = `${formatCount(body.length)} × ${formatCount(range.right - range.left + 1)}`;
			if (bottom < range.bottom) {
				toast.warn(`Copied the first ${formatCount(MAX_COPY_ROWS)} rows`, `${what} cells`);
			} else {
				toast.success(csv ? 'Copied as CSV' : 'Copied', `${what} cells`);
			}
		} catch (err) {
			toast.error('Copy failed', err instanceof Error ? err.message : String(err));
		}
	};

	const copy = (range: CellRange, options: CopyOptions = {}): void => {
		if (busy.current) {
			toast.info('Still copying the previous selection');
			return;
		}
		busy.current = true;
		setCopying(true);
		void run(range, options).finally(() => {
			busy.current = false;
			setCopying(false);
		});
	};

	return { copying, copy };
}
