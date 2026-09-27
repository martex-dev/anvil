import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { navHistory } from '../editor/nav-history';
import { renameOpenPath } from '../editor/rename';
import { createPath } from './explorer-ops';
import { joinPath, parentOf } from './tree-model';

/**
 * File operations with immediate cache invalidation. The watcher would catch up anyway;
 * invalidating here makes the tree update without waiting for its debounce.
 */
export function useFsActions(root: string): {
	/** Rejects on failure; the inline name input shows the reason next to the typed name. */
	create: (parent: string, name: string, kind: 'file' | 'dir') => Promise<FsEntry>;
	/** Rejects on failure, like `create`. */
	rename: (path: string, newName: string) => Promise<FsEntry>;
	trash: (path: string) => Promise<boolean>;
} {
	const client = useQueryClient();
	const refresh = (dir: string): void =>
		void client.invalidateQueries({ queryKey: fsKeys.list(root, dir) });

	const createM = useMutation({
		mutationFn: (v: { parent: string; name: string; kind: 'file' | 'dir' }) =>
			createPath(v.parent, v.name, v.kind),
		// A nested name (`a/b/c.py`) also created the folders on the way to it.
		onSuccess: (entry, v) => {
			for (let dir = parentOf(entry.path); ; dir = parentOf(dir)) {
				refresh(dir);
				if (dir === v.parent || dir === '') break;
			}
		},
	});
	const renameM = useMutation({
		mutationFn: (v: { path: string; newName: string }) => call('fs:rename', v),
		onSuccess: (entry, v) => {
			refresh(parentOf(v.path));
			// Open tabs and unsaved buffers follow the file (or everything in a renamed folder).
			renameOpenPath(root, v.path, joinPath(parentOf(v.path), entry.name));
		},
	});
	const trashM = useMutation({
		mutationFn: (path: string) => call('fs:trash', path),
		onSuccess: (_r, path) => {
			refresh(parentOf(path));
			// Back / Forward must not lead to a file that's gone.
			navHistory.forget(path);
			toast.info('Moved to Recycle Bin', path);
		},
		onError: (error) => toast.error('Could not delete', error.message),
	});

	return {
		create: (parent, name, kind) => createM.mutateAsync({ parent, name, kind }),
		rename: (path, newName) => renameM.mutateAsync({ path, newName }),
		trash: (path) =>
			trashM
				.mutateAsync(path)
				.then(() => true)
				.catch(() => false),
	};
}
