/**
 * The explorer's open folders, remembered per workspace folder so a reload, a folder switch and
 * back, or a restart shows the tree as it was left.
 */
const PREFIX = 'anvil.explorer.expanded:';
/** Enough for any real tree; stops a long-lived key growing with folders deleted since. */
const MAX_DIRS = 500;

/** Windows folders are case-insensitive: `C:\Proj` and `c:\proj` are the same project. */
function key(root: string): string {
	return `${PREFIX}${root.toLowerCase()}`;
}

export function loadExpanded(
	root: string,
	storage: Pick<Storage, 'getItem'> = localStorage,
): Set<string> {
	try {
		const raw: unknown = JSON.parse(storage.getItem(key(root)) ?? '[]');
		if (!Array.isArray(raw)) return new Set();
		return new Set(raw.filter((d): d is string => typeof d === 'string' && d.length > 0));
	} catch {
		// Unreadable or no storage: start collapsed, as a first open would.
		return new Set();
	}
}

export function saveExpanded(
	root: string,
	dirs: ReadonlySet<string>,
	storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
	try {
		if (dirs.size === 0) storage.removeItem(key(root));
		// Shallow folders first: they are the ones a capped list must keep.
		else
			storage.setItem(
				key(root),
				JSON.stringify(
					[...dirs]
						.sort((a, b) => a.split('/').length - b.split('/').length)
						.slice(0, MAX_DIRS),
				),
			);
	} catch {
		// Storage full or unavailable: the tree just opens collapsed next time.
	}
}
