import { useEffect } from 'react';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { useLayoutStore } from '../../stores/layout-store';
import { installLayoutPersistence } from './layout-persistence';

/** Restores pane sizes and open views on start; saves them (debounced) as they change. */
export function useLayoutPersistence(): void {
	useEffect(
		() =>
			installLayoutPersistence({
				store: useLayoutStore,
				load: async () => (await call('ui:getState'))['layout'],
				save: (layout) => call('ui:setState', { layout }),
				warn: (message, error) => rlog.warn('layout', message, error),
			}),
		[],
	);
}
