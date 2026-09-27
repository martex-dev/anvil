import { useEffect } from 'react';

import type { LaunchRequest } from '@shared/ipc/channels/app';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { confirmLeave, useWorkbenchStore } from '../../stores/workbench-store';

async function handle({ folder, file }: LaunchRequest): Promise<void> {
	if (folder) {
		const name = folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder;
		// Another folder replaces this one: unsaved files get their Save / Don't Save first.
		if (!(await confirmLeave(`opening ${name}`))) return;
		if (file) useWorkbenchStore.getState().queueOpen({ path: file });
		try {
			await call('workspace:open', folder);
		} catch (error) {
			useWorkbenchStore.getState().queueOpen(null);
			toast.error(
				`Could not open ${name}`,
				error instanceof Error ? error.message : undefined,
			);
		}
		return;
	}
	// The editor opens it now, or after the tabs it is restoring.
	if (file) useWorkbenchStore.getState().queueOpen({ path: file });
}

/**
 * Folders and files Anvil is asked to open from outside: the path it was started with, and
 * ones from later starts ("Open with Anvil" while it's running) that main forwards.
 */
export function useLaunchRequests(): void {
	useEffect(() => {
		call('app:takeLaunchRequest')
			.then((request) => (request ? handle(request) : undefined))
			.catch((error: unknown) =>
				rlog.warn('launch', 'could not read the launch path', error),
			);
	}, []);
	useAnvilEvent('app:launchRequest', (request) => void handle(request));
}
