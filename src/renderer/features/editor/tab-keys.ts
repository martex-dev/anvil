/**
 * Keyboard support for the tab strip (WAI-ARIA tabs with manual activation): arrows, Home and
 * End move focus between tabs, Enter or Space opens the focused one. Activating on every arrow
 * would swap the file into Monaco, which takes focus and ends the keyboard walk.
 */
export function tabKeyTarget(key: string, ids: readonly string[], current: string): string | null {
	const i = ids.indexOf(current);
	if (i === -1) return null;
	switch (key) {
		case 'ArrowRight':
			return ids[(i + 1) % ids.length] ?? null;
		case 'ArrowLeft':
			return ids[(i - 1 + ids.length) % ids.length] ?? null;
		case 'Home':
			return ids[0] ?? null;
		case 'End':
			return ids.at(-1) ?? null;
		default:
			return null;
	}
}

/** Focuses a tab element of `group` by tab id (tabs carry data-tab-id). */
export function focusTab(group: number, id: string): void {
	document
		.querySelector<HTMLElement>(
			`[role='tablist'][data-group='${group}'] [data-tab-id='${CSS.escape(id)}']`,
		)
		?.focus();
}
