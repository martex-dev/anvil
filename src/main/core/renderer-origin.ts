import { APP_ORIGIN } from './app-protocol';

/**
 * The Vite dev server URL, or null. Only honoured in unpackaged runs: in an installed Anvil the
 * variable would let anything that can set the environment point the privileged window (and
 * its IPC trust) at a page of its choosing.
 */
export function devRendererUrl(
	packaged: boolean,
	env: NodeJS.ProcessEnv = process.env,
): string | null {
	if (packaged) return null;
	const url = env['ELECTRON_RENDERER_URL'];
	return url ? url : null;
}

/**
 * Scheme and host (with port) of a URL. Not `URL.origin`, which is "null" for custom schemes
 * like app://.
 */
function originOf(url: string): string | null {
	try {
		const parsed = new URL(url);
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return null;
	}
}

/**
 * Whether a frame URL is Anvil's own renderer. Compared by exact origin: a prefix test let
 * `http://localhost:51730` pass for `http://localhost:5173`.
 */
export function isTrustedRendererUrl(url: string, devUrl: string | null): boolean {
	const origin = originOf(url);
	if (origin === null) return false;
	if (origin === originOf(APP_ORIGIN)) return true;
	return devUrl !== null && origin === originOf(devUrl);
}
