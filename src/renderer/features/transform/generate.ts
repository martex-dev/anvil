/** "Insert …" generators. All randomness comes from the Web Crypto API, never Math.random. */

const NANOID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

/** A random v4 UUID. */
export function uuid(): string {
	return globalThis.crypto.randomUUID();
}

/** A URL-safe random id (nanoid-compatible alphabet, 64 symbols). */
export function nanoid(size = 21): string {
	if (!Number.isInteger(size) || size < 1)
		throw new Error('nanoid size must be a positive integer');
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(size));
	// 64 symbols, so masking to 6 bits maps every byte uniformly with no modulo bias.
	return Array.from(bytes, (b) => NANOID_ALPHABET.charAt(b & 63)).join('');
}

export function isoNow(now: number = Date.now()): string {
	return new Date(now).toISOString();
}

export function unixSeconds(now: number = Date.now()): string {
	return String(Math.floor(now / 1000));
}

export function unixMillis(now: number = Date.now()): string {
	return String(Math.floor(now));
}

/**
 * Random hex for test fixtures and placeholder ids. Not a key: it's meant to be pasted into
 * source files, and anything pasted into source is not a secret.
 */
export function randomHex(bytes = 32): string {
	if (!Number.isInteger(bytes) || bytes < 1 || bytes > 65536) {
		throw new Error('randomHex size must be an integer from 1 to 65536');
	}
	const buf = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

const LOREM =
	'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut ' +
	'labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco ' +
	'laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in ' +
	'voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat ' +
	'cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const LOREM_WORDS = LOREM.split(' ');

/** The classic passage, repeated as needed and cut to `words` words, always ending in '.'. */
export function loremIpsum(words = 30): string {
	if (!Number.isInteger(words) || words < 1)
		throw new Error('Word count must be a positive integer');
	const out = Array.from({ length: words }, (_, i) => LOREM_WORDS[i % LOREM_WORDS.length] ?? '');
	return out.join(' ').replace(/[.,]?$/, '.');
}
