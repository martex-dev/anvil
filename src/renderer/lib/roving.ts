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
	const index = items.findIndex((el) => el === document.activeElement);
	const target = rovingTarget(event.key, index, items.length);
	if (target === null) return;
	event.preventDefault();
	items[target]?.focus();
	items[target]?.scrollIntoView({ block: 'nearest' });
}
