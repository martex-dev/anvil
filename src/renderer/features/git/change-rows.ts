/**
 * Rows a change list renders. An un-ignored venv or build folder can put tens of thousands of
 * untracked files in `git status -uall`; rendering them all (and again on every status poll)
 * freezes the panel, and nobody scrolls that far anyway.
 */
export const MAX_CHANGE_ROWS = 1000;

/** The first `limit` items, plus how many were left out. */
export function capRows<T>(
	items: readonly T[],
	limit: number = MAX_CHANGE_ROWS,
): { shown: readonly T[]; hidden: number } {
	if (items.length <= limit) return { shown: items, hidden: 0 };
	return { shown: items.slice(0, limit), hidden: items.length - limit };
}
