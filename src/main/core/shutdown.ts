export interface ShutdownOptions {
	/** Cleanup steps; they run in parallel and one failing never skips the others. */
	steps: Array<() => Promise<void> | void>;
	/** Runs last, always: after the steps finish, fail or hit the deadline (e.g. flush settings). */
	finally: () => void;
	/** How long the steps may take before quitting anyway. */
	timeoutMs: number;
	logError: (message: string, error?: unknown) => void;
}

/**
 * Runs shutdown cleanup with a deadline. A hung dispose (a process that never exits) must not
 * keep an invisible Anvil alive, which would also block installing updates.
 */
export async function shutdownWithin(options: ShutdownOptions): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<'timeout'>((resolve) => {
		timer = setTimeout(() => resolve('timeout'), options.timeoutMs);
	});
	const cleanup = Promise.allSettled(
		options.steps.map(async (step) => {
			await step();
		}),
	).then((results) => {
		for (const r of results) {
			if (r.status === 'rejected') options.logError('[main] error during shutdown', r.reason);
		}
		return 'done' as const;
	});
	try {
		const outcome = await Promise.race([cleanup, deadline]);
		if (outcome === 'timeout') {
			options.logError(`[main] shutdown took over ${options.timeoutMs} ms, quitting anyway`);
		}
	} finally {
		clearTimeout(timer);
		try {
			options.finally();
		} catch (error) {
			options.logError('[main] final shutdown step failed', error);
		}
	}
}
