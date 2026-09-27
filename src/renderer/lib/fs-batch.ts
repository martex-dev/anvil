import type { EventPayload } from '@shared/ipc/contract';

export type FsBatch = EventPayload<'fs:changed'>;

/**
 * Whether a watcher batch may have changed `path`. An overflow batch (a checkout or unzip of
 * thousands of files) lists nothing, so it may have changed anything.
 */
export function touchesFile(batch: FsBatch, path: string): boolean {
	return batch.overflow === true || batch.files.includes(path);
}
