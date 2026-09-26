import type { UpdateStatus } from '@shared/ipc/channels/update';

/** One line for an update status (Settings → About). */
export function describeUpdate(status: UpdateStatus | undefined): string {
	switch (status?.state) {
		case undefined:
			return '…';
		case 'disabled':
			return `Updates are off: ${status.reason.toLowerCase()}.`;
		case 'idle':
			return status.lastChecked
				? `Up to date (checked ${new Date(status.lastChecked).toLocaleString()}).`
				: 'Checks a minute after start, then every 6 hours.';
		case 'checking':
			return 'Checking…';
		case 'downloading':
			return `Downloading ${status.version}: ${status.percent}%`;
		case 'ready':
			return `${status.version} is downloaded: restart to install it.`;
		case 'error':
			return `Last check failed: ${status.message}`;
	}
}

/** The toast after "Check for Updates": a failure is an error, everything else news. */
export function updateCheckToast(status: UpdateStatus): {
	tone: 'info' | 'error';
	title: string;
	description: string;
} {
	switch (status.state) {
		case 'error':
			return { tone: 'error', title: 'Update check failed', description: status.message };
		case 'disabled':
			return { tone: 'info', title: 'Updates are off', description: status.reason };
		case 'idle':
			return { tone: 'info', title: 'Updates', description: 'You are up to date.' };
		case 'checking':
			return { tone: 'info', title: 'Updates', description: 'Checking for updates…' };
		case 'downloading':
			return {
				tone: 'info',
				title: `Anvil ${status.version} is available`,
				description: `Downloading: ${status.percent}%`,
			};
		case 'ready':
			return {
				tone: 'info',
				title: `Anvil ${status.version} is ready`,
				description: 'Restart to install it.',
			};
	}
}
