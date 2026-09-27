import type { AiContext } from '@shared/ipc/channels/ai';
import { isEnvFile, scanText } from '@shared/secret-scan';

/**
 * Keeps credentials out of what the AI features send to a cloud model: the renderer-side half
 * of the Secret Shield. Selections the user rewrites with Ctrl+I go out as they are (the reply
 * must fit back in place); everything else passes through here.
 */

const DOT = '•';

/** Files that hold credentials by nature, whatever the scanner finds in them. */
export function isSecretFile(path: string): boolean {
	const name = (path.split(/[\\/]/).at(-1) ?? '').toLowerCase();
	return (
		isEnvFile(name) ||
		/\.(?:pem|key|p12|pfx|jks|keystore)$/.test(name) ||
		// SSH private keys; the .pub next to them is meant to be shared.
		(/^id_(?:rsa|dsa|ecdsa|ed25519)/.test(name) && !name.endsWith('.pub')) ||
		/keypair[^/]*\.json$/.test(name) ||
		/^secrets?\./.test(name) ||
		/^credentials/.test(name) ||
		name === '.netrc' ||
		name === '.pypirc'
	);
}

/** True when the scanner flags anything in `text`. */
export function hasSecrets(text: string): boolean {
	return scanText(text).length > 0;
}

/**
 * Same length as the secret, so offsets computed on the real text (the inline edit's cursor)
 * still line up. A few characters at each end stay, as in the editor's shield, so the model
 * (and you) can tell which key a line uses.
 */
function maskSpan(secret: string): string {
	if (secret.length <= 10) return DOT.repeat(secret.length);
	return `${secret.slice(0, 4)}${DOT.repeat(secret.length - 8)}${secret.slice(-4)}`;
}

/** `KEY=value` lines: every value in a dotenv file is secret-ish, so all of them are masked. */
const ENV_LINE = /^([ \t]*(?:export[ \t]+)?[A-Za-z_][\w.-]*[ \t]*=[ \t]*)(.+)$/gm;

/**
 * `text` with every secret the shared scanner finds (and, for a dotenv file, every value)
 * replaced by dots of the same length. `masked` counts what was hidden.
 */
export function maskSecrets(text: string, path = ''): { text: string; masked: number } {
	let masked = 0;
	let out = text;
	if (path && isEnvFile(path.split(/[\\/]/).at(-1) ?? '')) {
		out = out.replace(ENV_LINE, (_, key: string, value: string) => {
			masked++;
			return key + DOT.repeat(value.length);
		});
	}
	const findings = scanText(out);
	if (findings.length === 0) return { text: out, masked };
	const lineStarts = [0];
	for (let i = 0; i < out.length; i++) if (out[i] === '\n') lineStarts.push(i + 1);
	let result = '';
	let from = 0;
	for (const f of findings) {
		const start = (lineStarts[f.line - 1] ?? 0) + f.column - 1;
		if (start < from) continue;
		let end = start + f.length;
		let replacement = maskSpan(out.slice(start, end));
		// The scanner flags a private key by its BEGIN line; the key itself is the body below it.
		if (f.kind === 'Private key block') {
			const footer = out.indexOf('-----END', end);
			const bodyEnd = footer === -1 ? out.length : footer;
			replacement = out.slice(start, end) + out.slice(end, bodyEnd).replace(/[^\r\n]/g, DOT);
			end = bodyEnd;
		}
		result += out.slice(from, start) + replacement;
		from = end;
		masked++;
	}
	return { text: result + out.slice(from), masked };
}

/** The workspace path a context item was taken from, when it names one. */
function pathOf(item: AiContext): string {
	if (item.kind === 'file') return item.label;
	if (item.kind === 'selection') return item.label.replace(/:\d+-\d+$/, '');
	return '';
}

/**
 * A context item safe to send: a key file's content is withheld, other text has its secrets
 * masked. `hidden` counts the secrets masked (a withheld file counts as one).
 */
export function safeContext(item: AiContext): { item: AiContext; hidden: number } {
	const path = pathOf(item);
	if (path && isSecretFile(path) && !isEnvFile(path.split(/[\\/]/).at(-1) ?? '')) {
		return {
			item: { ...item, text: `(Content withheld: ${path} holds credentials.)` },
			hidden: 1,
		};
	}
	const { text, masked } = maskSecrets(item.text, path);
	return { item: masked ? { ...item, text } : item, hidden: masked };
}
