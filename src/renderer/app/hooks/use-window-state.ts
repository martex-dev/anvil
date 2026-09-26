import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { WindowState } from '@shared/ipc/channels/window';

import { call } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';

const KEY = ['window', 'state'] as const;
const INITIAL: WindowState = { maximized: false, focused: true, fullScreen: false };

/** Maximized / focused state for skin-drawn window buttons. */
export function useWindowState(): WindowState {
	const client = useQueryClient();
	const query = useQuery({ queryKey: KEY, queryFn: () => call('window:state') });
	useAnvilEvent('window:changed', (next) => client.setQueryData(KEY, next));
	return query.data ?? INITIAL;
}

export const windowActions = {
	minimize: (): void => void call('window:minimize'),
	toggleMaximize: (): void => void call('window:toggleMaximize'),
	close: (): void => void call('window:close'),
};
