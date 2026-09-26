const KEY = 'anvil.recentCommands';
const MAX = 6;

/** Most-recent-first list with `id` moved to the front, capped at `max`. */
export function bumpRecent(list: readonly string[], id: string, max = MAX): string[] {
	return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

export function readRecentCommands(): string[] {
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		// Storage blocked or a corrupt value: no history is fine.
		return [];
	}
}

export function recordRecentCommand(id: string): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(bumpRecent(readRecentCommands(), id)));
	} catch {
		// Recents are a convenience; a full or blocked storage must not break running commands.
	}
}
