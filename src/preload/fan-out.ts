/** Re-raises outside the loop, so the error still reaches DevTools and the error handlers. */
function rethrowLater(error: unknown): void {
	queueMicrotask(() => {
		throw error;
	});
}

/**
 * Calls every subscriber of an event. A subscriber that throws must not stop the others: one
 * panel's bug would otherwise leave the explorer, editors or language client silently stale.
 */
export function fanOut(
	handlers: Iterable<(payload: unknown) => void>,
	payload: unknown,
	report: (error: unknown) => void = rethrowLater,
): void {
	for (const handler of handlers) {
		try {
			handler(payload);
		} catch (error) {
			report(error);
		}
	}
}
