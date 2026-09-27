import { create } from 'zustand';

/**
 * Items cut or copied in the explorer, waiting for Paste. Kept apart from the system clipboard
 * (which still gets nothing): these are workspace paths, only meaningful inside this folder.
 */
interface ExplorerClipboard {
	mode: 'cut' | 'copy';
	paths: string[];
	/** The folder they belong to; a paste after a folder switch would name other files. */
	root: string;
}

export const useExplorerClipboard = create<{ held: ExplorerClipboard | null }>(() => ({
	held: null,
}));

export function holdPaths(root: string, mode: 'cut' | 'copy', paths: string[]): void {
	useExplorerClipboard.setState({ held: paths.length > 0 ? { mode, paths, root } : null });
}

/** What Paste would act on in `root`, or null. */
export function heldFor(root: string): ExplorerClipboard | null {
	const { held } = useExplorerClipboard.getState();
	return held && held.root === root ? held : null;
}

/** A cut is used up by its paste (the items have moved); a copy can be pasted again. */
export function afterPaste(): void {
	const { held } = useExplorerClipboard.getState();
	if (held?.mode === 'cut') useExplorerClipboard.setState({ held: null });
}
