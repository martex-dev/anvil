import { useEffect, useRef } from 'react';

import type { AnvilEvent, EventPayload } from '@shared/ipc/contract';

/** Subscribes to a main → renderer event for the lifetime of the component. */
export function useAnvilEvent<E extends AnvilEvent>(
	event: E,
	handler: (payload: EventPayload<E>) => void,
): void {
	const ref = useRef(handler);
	useEffect(() => {
		ref.current = handler;
	});
	useEffect(() => window.anvil.on(event, (payload) => ref.current(payload)), [event]);
}
