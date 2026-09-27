import { type RefObject, useEffect, useState } from 'react';

/** Every explorer row is `h-6`. */
export const ROW_HEIGHT = 24;
/**
 * Below this many rows everything is rendered: memoised rows stay cheap, and a full DOM keeps
 * find-in-page and scrolling exact. An expanded node_modules easily passes it.
 */
export const WINDOW_FROM = 1500;
/** Rows rendered above and below the viewport while windowed. */
const OVERSCAN = 30;

export interface RowWindow {
	start: number;
	end: number;
	/** Space for the rows not rendered above and below the window. */
	before: number;
	after: number;
}

/** The rows of `count` to render for a viewport at `scrollTop` of `height` pixels. */
export function rowWindow(count: number, scrollTop: number, height: number): RowWindow {
	if (count < WINDOW_FROM) return { start: 0, end: count, before: 0, after: 0 };
	const first = Math.floor(scrollTop / ROW_HEIGHT);
	const start = Math.max(0, first - OVERSCAN);
	const end = Math.min(count, first + Math.ceil(height / ROW_HEIGHT) + OVERSCAN);
	return { start, end, before: start * ROW_HEIGHT, after: (count - end) * ROW_HEIGHT };
}

/** The nearest scrolling ancestor, which the tree's rows scroll in. */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
	return el?.closest<HTMLElement>('[data-scroll-container]') ?? null;
}

/**
 * Tracks the scroll container around `ref` and returns the window of rows to render. Only
 * listens while windowing is on, so small trees pay nothing.
 */
export function useRowWindow(ref: RefObject<HTMLElement | null>, count: number): RowWindow {
	const [view, setView] = useState({ top: 0, height: 800 });
	const windowed = count >= WINDOW_FROM;
	useEffect(() => {
		const scroller = scrollParent(ref.current);
		if (!windowed || !scroller) return;
		const update = (): void =>
			setView({ top: scroller.scrollTop, height: scroller.clientHeight });
		// The tree may already be scrolled when it grows past the threshold; measure once laid out.
		const frame = requestAnimationFrame(update);
		scroller.addEventListener('scroll', update, { passive: true });
		const observer = new ResizeObserver(update);
		observer.observe(scroller);
		return () => {
			cancelAnimationFrame(frame);
			scroller.removeEventListener('scroll', update);
			observer.disconnect();
		};
	}, [ref, windowed]);
	return rowWindow(count, view.top, view.height);
}

/**
 * Brings row `index` into view. Rendered rows scroll themselves; a row outside the window has
 * no element yet, so the container is scrolled to where it will be.
 */
export function revealRow(container: HTMLElement | null, path: string, index: number): void {
	const row = container?.querySelector(`[data-path="${CSS.escape(path)}"]`);
	if (row) {
		row.scrollIntoView({ block: 'nearest' });
		return;
	}
	const scroller = scrollParent(container);
	if (!scroller || index < 0) return;
	const top = index * ROW_HEIGHT;
	if (top < scroller.scrollTop || top + ROW_HEIGHT > scroller.scrollTop + scroller.clientHeight)
		scroller.scrollTop = top - scroller.clientHeight / 2;
}
