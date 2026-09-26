import { defaultFilter } from 'cmdk';

const RECENT_KEY = 'anvil.recentFiles';

export function rememberRecentFile(path: string): void {
	try {
		const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
		const prev = Array.isArray(list)
			? list.filter((p): p is string => typeof p === 'string' && p !== path)
			: [];
		localStorage.setItem(RECENT_KEY, JSON.stringify([path, ...prev].slice(0, 30)));
	} catch {
		// Recents are a nicety.
	}
}

export function recentFiles(): string[] {
	try {
		const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
		return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : [];
	} catch {
		return [];
	}
}

export type QuickOpenMode = 'files' | 'commands' | 'symbols' | 'line';

/** `>` runs commands, `@` jumps to a symbol, `:` goes to a line; anything else finds files. */
export function quickOpenMode(value: string): QuickOpenMode {
	if (value.startsWith('>')) return 'commands';
	if (value.startsWith('@')) return 'symbols';
	if (value.startsWith(':')) return 'line';
	return 'files';
}

/**
 * cmdk scores items against the raw input, which still carries the mode prefix (`>git`), and no
 * item contains `>` or `@`, so the built-in filter hid everything. Score without the prefix.
 */
export function quickOpenFilter(value: string, search: string, keywords?: string[]): number {
	return defaultFilter(value, search.replace(/^[>@]\s*/, ''), keywords);
}

/**
 * Enter pressed while the file list is still loading is remembered for the query it was pressed
 * on. Returns the file to open once the list has it, and whether the pending Enter is spent: an
 * edit (the query changed) or a finished load with no match cancels it, so a later match never
 * opens a file without a fresh Enter.
 */
export function resolvePendingEnter(
	pendingFor: string | null,
	query: string,
	fetching: boolean,
	firstMatch: string | undefined,
): { open: string | undefined; cancel: boolean } {
	if (pendingFor === null) return { open: undefined, cancel: false };
	if (pendingFor !== query) return { open: undefined, cancel: true };
	if (firstMatch) return { open: firstMatch, cancel: false };
	return { open: undefined, cancel: !fetching };
}
