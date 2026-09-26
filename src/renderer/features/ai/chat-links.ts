import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';

function copyLink(href: string): void {
	navigator.clipboard.writeText(href).then(
		() => toast.success('Link copied'),
		(error: unknown) =>
			toast.error('Could not copy', error instanceof Error ? error.message : undefined),
	);
}

/**
 * A link clicked in a reply. Only https opens in the browser (main enforces the same rule);
 * anything else (http, mailto, relative, [[wikilinks]]) says so and offers to copy it
 * instead of silently doing nothing.
 */
export function openChatLink(href: string): void {
	if (href.startsWith('https://')) {
		call('app:openExternal', href).catch((error: unknown) =>
			toast.error('Could not open link', error instanceof Error ? error.message : undefined),
		);
		return;
	}
	toast.info('Link not opened', `Only https links open from chat: ${href}`, {
		label: 'Copy link',
		run: () => copyLink(href),
	});
}
