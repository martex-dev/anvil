import type { FsEntry } from '@shared/ipc/channels/fs';

import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { runPythonAt } from '../python/run';
import { newTerminal } from '../terminal/terminal-store';
import { afterPaste, heldFor, holdPaths, useExplorerClipboard } from './explorer-clipboard';
import type { EntryActions } from './explorer-menu';
import { transferPaths } from './explorer-ops';
import { parentOf } from './tree-model';

const errorText = (error: unknown): string | undefined =>
	error instanceof Error ? error.message : undefined;

/**
 * The explorer's entry actions (context menu and Ctrl+X / C / V). `onPlaced` gets the items a
 * paste or duplicate produced, so the tree can reveal and focus them.
 */
export function useEntryActions(
	root: string,
	onPlaced: (entries: FsEntry[]) => void,
): EntryActions {
	const canPaste = useExplorerClipboard((s) => s.held?.root === root);

	const place = (mode: 'move' | 'copy', paths: string[], dir: string): Promise<boolean> =>
		transferPaths(root, mode, paths, dir).then((placed) => {
			if (placed.length > 0) onPlaced(placed);
			return placed.length > 0;
		});

	return {
		openToSide: (path) => {
			if (!requestOpenFile({ path, side: true })) toast.warn('No editor is available');
		},
		openInTerminal: (dir) =>
			newTerminal('powershell', dir ? dir.slice(dir.lastIndexOf('/') + 1) : undefined, dir),
		runPython: (path) => {
			runPythonAt(path).catch((error: unknown) =>
				toast.error(`Could not run ${path}`, errorText(error)),
			);
		},
		cut: (path) => holdPaths(root, 'cut', [path]),
		copy: (path) => holdPaths(root, 'copy', [path]),
		paste: (dir) => {
			const held = heldFor(root);
			if (!held) {
				toast.info('Nothing to paste', 'Cut or copy a file in the Explorer first.');
				return;
			}
			void place(held.mode === 'cut' ? 'move' : 'copy', held.paths, dir).then((ok) => {
				if (ok) afterPaste();
			});
		},
		canPaste,
		duplicate: (path) => void place('copy', [path], parentOf(path)),
	};
}
