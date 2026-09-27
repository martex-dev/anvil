import { type RefObject, useEffect, useRef, useState } from 'react';

import { useWorkbenchStore } from '../../stores/workbench-store';
import type { TreeRow } from './tree-model';
import { revealRow } from './use-row-window';

interface RevealDeps {
	rows: TreeRow[];
	isRootLoading: boolean;
	containerRef: RefObject<HTMLDivElement | null>;
	focused: string | null;
	activeFile: string | null;
	/** Expands the ancestors of `path` and focuses its row. */
	reveal: (path: string) => void;
}

/**
 * Keeps the tree on what the user is looking at: it follows the editor's active file, answers
 * "Reveal in Explorer View" (taking focus), and scrolls the focused row into view.
 */
export function useTreeReveal({
	rows,
	isRootLoading,
	containerRef,
	focused,
	activeFile,
	reveal,
}: RevealDeps): void {
	const revealRequest = useWorkbenchStore((s) => s.reveal);

	// Follow the editor: reveal and highlight the active file. Adjusting state during render
	// (instead of in an effect) avoids an extra render pass.
	const [seenActive, setSeenActive] = useState<string | null>(null);
	if (activeFile !== seenActive) {
		setSeenActive(activeFile);
		if (activeFile) reveal(activeFile);
	}

	// An explicit "Reveal in Explorer View" (e.g. from a tab): same, and the tree takes focus.
	const [seenReveal, setSeenReveal] = useState<number | null>(null);
	if (revealRequest && revealRequest.nonce !== seenReveal) {
		setSeenReveal(revealRequest.nonce);
		reveal(revealRequest.path);
	}

	useEffect(() => {
		// Still loading: the tree isn't mounted yet, so wait for it before taking focus.
		const container = containerRef.current;
		if (!revealRequest || !container) return;
		container.focus();
		// The row may already be focused (and scrolled to once) but out of view now; rows still
		// waiting on folder listings are scrolled to by the effect below once they appear.
		revealRow(container, revealRequest.path, -1);
		useWorkbenchStore.getState().clearReveal();
	}, [revealRequest, isRootLoading, containerRef]);

	// Scroll the focused row into view once it exists: revealing a nested file expands folders
	// whose listings load later, so the row may only appear after a few more renders.
	const scrolledTo = useRef<string | null>(null);
	useEffect(() => {
		if (!focused) scrolledTo.current = null;
		if (!focused || scrolledTo.current === focused) return;
		const index = rows.findIndex((r) => r.kind === 'entry' && r.entry.path === focused);
		if (index === -1) return;
		scrolledTo.current = focused;
		revealRow(containerRef.current, focused, index);
	}, [focused, rows, containerRef]);
}
