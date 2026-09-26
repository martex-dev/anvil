import type { SearchFile } from '@shared/ipc/channels/search';

/**
 * Matches in one file, counted like the summary's `matchCount` (main's ResultCollector): every
 * highlighted range, and a line whose ranges were dropped still counts once.
 */
export function fileMatchCount(file: SearchFile): number {
	return file.matches.reduce((n, m) => n + (m.ranges.length || 1), 0);
}
