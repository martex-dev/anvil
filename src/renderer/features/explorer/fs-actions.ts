import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { fsKeys } from '../../app/hooks/use-fs-invalidation';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { navHistory } from '../editor/nav-history';
import { parentOf } from './tree-model';

/**
 * File operations with immediate cache invalidation. The watcher would catch up anyway;
 * invalidating here makes the tree update without waiting for its debounce.
 */
export function useFsActions(root: string): {
	create: (parent: string, name: string, kind: 'file' | 'dir') => Promise<FsEntry | null>;
	rename: (path: string, newName: string) => Promise<FsEntry | null>;
	trash: (path: string) => Promise<boolean>;
} {
	const client = useQueryClient();
	const refresh = (dir: string): void =>
		void client.invalidateQueries({ queryKey: fsKeys.list(root, dir) });

	const createM = useMutation({
		mutationFn: (v: { parent: string; name: string; kind: 'file' | 'dir' }) =>
			call('fs:create', v),
		onSuccess: (_e, v) => refresh(v.parent),
		onError: (error) => toast.error('Could not create', error.message),
	});
	const renameM = useMutation({
		mutationFn: (v: { path: string; newName: string }) => call('fs:rename', v),
		onSuccess: (_e, v) => refresh(parentOf(v.path)),
		onError: (error) => toast.error('Could not rename', error.message),
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
		create: (parent, name, kind) =>
			createM.mutateAsync({ parent, name, kind }).catch(() => null),
		rename: (path, newName) => renameM.mutateAsync({ path, newName }).catch(() => null),
		trash: (path) =>
			trashM
				.mutateAsync(path)
				.then(() => true)
				.catch(() => false),
	};
}
