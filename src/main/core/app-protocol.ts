import { isAbsolute, join, normalize, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { net, protocol } from 'electron';

export const APP_SCHEME = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://anvil`;

/**
 * Must run before `app.ready`. A standard, secure scheme behaves like https for the renderer:
 * `fetch`, workers and WASM work (they don't from file://), and CSP 'self' means our own files.
 */
export function registerAppScheme(): void {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: APP_SCHEME,
			privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
		},
	]);
}

/** Maps app://anvil/<path> to a file inside `rootDir`, refusing anything outside it. */
export function resolveAppPath(rootDir: string, url: string): string | null {
	const { host, pathname } = new URL(url);
	if (host !== 'anvil') return null;
	const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
	const abs = normalize(join(rootDir, rel));
	const back = relative(rootDir, abs);
	if (back.startsWith('..') || isAbsolute(back)) return null;
	return abs;
}

/** Serves the built renderer (out/renderer) over app://anvil/. Call after `app.ready`. */
export function serveRenderer(rootDir: string): void {
	protocol.handle(APP_SCHEME, async (request) => {
		const abs = resolveAppPath(rootDir, request.url);
		if (!abs) return new Response('Not found', { status: 404 });
		return net.fetch(pathToFileURL(abs).toString());
	});
}
