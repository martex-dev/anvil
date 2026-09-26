import { useEffect } from 'react';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { type LayoutState, sanitizeLayout, useLayoutStore } from '../../stores/layout-store';

const PERSISTED: Array<keyof LayoutState> = [
	'sideView',
	'sideOpen',
	'sideWidth',
	'panelOpen',
	'panelTab',
	'panelHeight',
	'aiOpen',
	'aiWidth',
	'splitRatio',
];

/** Restores pane sizes and open views on start; saves them (debounced) as they change. */
export function useLayoutPersistence(): void {
	useEffect(() => {
		let ready = false;
		let timer: ReturnType<typeof setTimeout> | null = null;
		call('ui:getState')
			.then((state) => {
				const layout = state['layout'];
				if (layout && typeof layout === 'object')
					useLayoutStore
						.getState()
						.hydrate(sanitizeLayout(layout as Record<string, unknown>));
			})
			.catch((error: unknown) => rlog.warn('layout', 'restore failed', error))
			.finally(() => {
				ready = true;
			});
		const off = useLayoutStore.subscribe((s) => {
			if (!ready) return;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				const layout = Object.fromEntries(PERSISTED.map((k) => [k, s[k]]));
				void call('ui:setState', { layout }).catch(() => undefined);
			}, 400);
		});
		return () => {
			off();
			if (timer) clearTimeout(timer);
		};
	}, []);
}
