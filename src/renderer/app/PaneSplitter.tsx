import type { ComponentProps, JSX } from 'react';

import { PANE_LIMITS, useLayoutStore } from '../stores/layout-store';
import { Splitter } from '../ui/Splitter';

type Pane = keyof typeof PANE_LIMITS;

/** Spoken size: pixels, or the left group's share for the editor split. */
export function paneValueText(pane: Pane, now: number): string {
	return pane === 'splitRatio' ? `${Math.round(now * 100)}%` : `${Math.round(now)} pixels`;
}

/**
 * A Splitter for one layout pane that reports the pane's size to screen readers. It reads the
 * size itself, so a drag re-renders only the splitter, not AppShell.
 */
export function PaneSplitter({
	pane,
	...props
}: { pane: Pane } & Omit<ComponentProps<typeof Splitter>, 'value'>): JSX.Element {
	const now = useLayoutStore((s) => s[pane]);
	const { min, max } = PANE_LIMITS[pane];
	return <Splitter {...props} value={{ now, min, max, text: paneValueText(pane, now) }} />;
}
