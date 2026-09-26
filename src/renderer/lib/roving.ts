import type { KeyboardEvent } from 'react';

/**
 * Arrow-key target for a horizontal tab strip (WAI-ARIA tabs pattern): Left/Right wrap around,
 * Home/End jump to the ends. Returns null for any other key, or when there are no tabs.
 */
export function rovingIndex(key: string, index: number, count: number): number | null {
	if (count <= 0) return null;
	switch (key) {
		case 'ArrowRight':
			return (index + 1) % count;
		case 'ArrowLeft':
			return (index - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

/**
 * Handles arrow keys on a `role='tab'` element: activates the target tab via `select` and moves
 * focus to it (tabs use roving tabIndex, so only the selected one is in the Tab order).
 */
export function handleTabKeys(
	e: KeyboardEvent<HTMLElement>,
	index: number,
	count: number,
	select: (index: number) => void,
): void {
	const next = rovingIndex(e.key, index, count);
	if (next === null) return;
	e.preventDefault();
	select(next);
	const tabs = e.currentTarget
		.closest('[role="tablist"]')
		?.querySelectorAll<HTMLElement>('[role="tab"]');
	tabs?.[next]?.focus();
}
