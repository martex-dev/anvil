import type { UpdateStatus } from '@shared/ipc/channels/update';

export type UpdaterEvent =
	| { type: 'checking' }
	| { type: 'available'; version: string }
	| { type: 'not-available'; at: number }
	| { type: 'progress'; percent: number }
	| { type: 'downloaded'; version: string }
	| { type: 'error'; message: string; at: number };

/** electron-updater's event stream → one status the UI can render. */
export function reduceUpdate(state: UpdateStatus, event: UpdaterEvent): UpdateStatus {
	// A downloaded update stays ready: a later background check must not hide the restart button.
	if (state.state === 'ready' && event.type !== 'downloaded') return state;
	switch (event.type) {
		case 'checking':
			return { state: 'checking' };
		case 'available':
			return { state: 'downloading', version: event.version, percent: 0 };
		case 'progress':
			return state.state === 'downloading'
				? { ...state, percent: Math.max(0, Math.min(100, Math.round(event.percent))) }
				: state;
		case 'downloaded':
			return { state: 'ready', version: event.version };
		case 'not-available':
			return { state: 'idle', lastChecked: event.at };
		case 'error':
			return { state: 'error', message: event.message, lastChecked: event.at };
	}
}

/** GitHub's "no releases yet" and offline errors are long stack traces; show one plain line. */
export function describeUpdateError(error: unknown): string {
	const text = error instanceof Error ? error.message : String(error);
	if (/404|Cannot find latest\.yml|No published versions/i.test(text)) {
		return 'No release published yet';
	}
	if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::ERR_/i.test(text))
		return 'Offline: will retry later';
	return text.split('\n')[0]?.slice(0, 200) ?? 'Update check failed';
}
