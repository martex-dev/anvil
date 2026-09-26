import type { KeyboardEvent } from 'react';

/**
 * Roving focus for flat lists and trees (WAI-ARIA): the list is one Tab stop and the arrow
 * keys move between its items. Items are the focusable elements marked `data-roving` inside
 * the element that handles the keydown.
 */

/** Index focus moves to for `key`, or null when the key is not a navigation key. */
export function rovingTarget(key: string, index: number, count: number): number | null {
	if (count === 0) return null;
	switch (key) {
		case 'ArrowDown':
			return Math.min(count - 1, index + 1);
		case 'ArrowUp':
			return Math.max(0, index - 1);
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

/** Keydown handler for a list container: moves DOM focus between its `data-roving` items. */
export function rovingKeyDown(event: KeyboardEvent<HTMLElement>): void {
	const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-roving]'));
	// Focus may be on a control inside an item (a row's action button).
	const index = items.findIndex((el) => el.contains(document.activeElement));
	const target = rovingTarget(event.key, index, items.length);
	if (target === null) return;
	event.preventDefault();
	items[target]?.focus();
	items[target]?.scrollIntoView({ block: 'nearest' });
}

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
