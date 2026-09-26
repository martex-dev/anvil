import {
	useIsMutating,
	useMutation,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from '@tanstack/react-query';

import type { UpdateStatus } from '@shared/ipc/channels/update';

import { describeError } from '../../lib/global-errors';
import { call } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';

export const UPDATE_KEY = ['update', 'status'] as const;
const INSTALL_KEY = ['update', 'install'] as const;

/** Live update status: main pushes every change, so no polling. */
export function useUpdateStatus(): UseQueryResult<UpdateStatus> {
	const client = useQueryClient();
	useAnvilEvent('update:changed', (status) => client.setQueryData(UPDATE_KEY, status));
	return useQuery({ queryKey: UPDATE_KEY, queryFn: () => call('update:status') });
}

/**
 * "Restart to update", shared by Settings and the status bar: one install at a time across both
 * (a second click while main is quitting would only race it), with failures shown as a toast.
 */
export function useInstallUpdate(): { install: () => void; isPending: boolean } {
	const client = useQueryClient();
	const installing = useIsMutating({ mutationKey: INSTALL_KEY }) > 0;
	const mutation = useMutation({
		mutationKey: INSTALL_KEY,
		mutationFn: () => call('update:install'),
		onError: (error) => toast.error('Could not restart to update', describeError(error)),
	});
	return {
		install: () => {
			// Read the cache, not the render-time flag: a double click lands before the re-render.
			if (client.isMutating({ mutationKey: INSTALL_KEY }) === 0) mutation.mutate();
		},
		isPending: installing,
	};
}
