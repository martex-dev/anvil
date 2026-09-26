import type { ColumnStats, DataPage } from '@shared/ipc/channels/data';

import type { LoadSpec, PageQuery } from './store';

/** Messages between the data feature (main thread) and its worker thread. */
export type WorkerRequest =
	| { op: 'page'; spec: LoadSpec; query: PageQuery }
	| { op: 'stats'; spec: LoadSpec; column: number }
	| { op: 'evict'; abs: string }
	| { op: 'clear' };

export interface WorkerResults {
	page: DataPage;
	stats: ColumnStats;
	evict: undefined;
	clear: undefined;
}

export type WorkerEnvelope = WorkerRequest & { id: number };

export type WorkerResponse =
	| { id: number; ok: true; value: unknown }
	/** `code` is set for an AnvilError (safe to show); null for an unexpected crash. */
	| { id: number; ok: false; code: string | null; message: string; stack?: string };
