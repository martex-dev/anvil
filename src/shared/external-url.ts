/** Loopback hosts: local notebook and dashboard servers (Jupyter, Dash, Streamlit) serve plain http. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Links that may leave the app for the system browser: https anywhere, or http to this machine
 * only. Never credentials in the URL, never other schemes (file:, javascript:, ms-settings:…).
 */
export function isSafeExternalUrl(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	if (url.username !== '' || url.password !== '') return false;
	if (url.protocol === 'https:') return true;
	return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}
