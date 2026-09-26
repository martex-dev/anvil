type Level = 'info' | 'warn' | 'error';

function send(level: Level, scope: string, message: string, error?: unknown): void {
	const detail =
		error instanceof Error ? (error.stack ?? error.message) : error ? String(error) : undefined;
	void window.anvil
		.invoke('app:log', { level, scope, message, ...(detail ? { detail } : {}) })
		.catch(() => undefined);
}

/** Forwards renderer diagnostics to main's log file. */
export const rlog = {
	info: (scope: string, message: string) => send('info', scope, message),
	warn: (scope: string, message: string, error?: unknown) => send('warn', scope, message, error),
	error: (scope: string, message: string, error?: unknown) =>
		send('error', scope, message, error),
};
