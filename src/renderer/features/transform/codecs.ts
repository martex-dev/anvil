/** Pure encode/decode helpers. Every decoder throws an Error with a message fit for a toast. */

function utf8Decode(bytes: Uint8Array, what: string): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new Error(`${what} is not valid UTF-8 text`);
	}
}

// btoa/atob only speak Latin-1, so text goes through UTF-8 bytes first (é, 日本 would throw).
export function base64Encode(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	// Chunked so a large selection doesn't blow the argument limit of fromCharCode.
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

export function base64Decode(text: string): string {
	const bad = /[^A-Za-z0-9+/=_\-\s]/.exec(text);
	if (bad) throw new Error(`Invalid base64 character '${bad[0]}' at position ${bad.index + 1}`);
	// Accept base64url too: JWT segments and URL-safe tokens are what people usually paste.
	const clean = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("Invalid base64: misplaced '='");
	const unpadded = clean.replace(/=+$/, '');
	if (unpadded.length % 4 === 1) throw new Error('Invalid base64: wrong length');
	const binary = atob(unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4));
	const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
	return utf8Decode(bytes, 'Decoded base64');
}

export function urlDecode(text: string): string {
	try {
		// '+' means space in query strings; encodeURIComponent never emits a bare '+'.
		return decodeURIComponent(text.replace(/\+/g, ' '));
	} catch {
		const bad = /%(?![0-9a-fA-F]{2})/.exec(text);
		const where = bad ? ` at position ${bad.index + 1}` : '';
		throw new Error(`Invalid URL encoding${where}`);
	}
}

export function jsonEscape(text: string): string {
	return JSON.stringify(text).slice(1, -1);
}

const JSON_ESCAPES: Record<string, string> = {
	'"': '"',
	'\\': '\\',
	'/': '/',
	b: '\b',
	f: '\f',
	n: '\n',
	r: '\r',
	t: '\t',
};

/** Hand-rolled rather than JSON.parse so raw quotes and newlines in the selection are tolerated. */
export function jsonUnescape(text: string): string {
	const src = /^"[\s\S]*"$/.test(text) ? text.slice(1, -1) : text;
	let out = '';
	for (let i = 0; i < src.length; i++) {
		const ch = src.charAt(i);
		if (ch !== '\\') {
			out += ch;
			continue;
		}
		const next = src.charAt(i + 1);
		if (next === 'u') {
			const hex = src.slice(i + 2, i + 6);
			if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
				throw new Error(`Invalid \\u escape at position ${i + 1}`);
			}
			out += String.fromCharCode(parseInt(hex, 16));
			i += 5;
			continue;
		}
		const mapped = JSON_ESCAPES[next];
		if (mapped === undefined) {
			const shown = next === '' ? 'a trailing backslash' : `'\\${next}'`;
			throw new Error(`Invalid escape ${shown} at position ${i + 1}`);
		}
		out += mapped;
		i++;
	}
	return out;
}

const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

export function htmlEscape(text: string): string {
	return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	copy: '©',
	reg: '®',
	trade: '™',
	hellip: '…',
	mdash: '—',
	ndash: '–',
	laquo: '«',
	raquo: '»',
	euro: '€',
	pound: '£',
	yen: '¥',
	cent: '¢',
	deg: '°',
	times: '×',
	divide: '÷',
	middot: '·',
};

export function htmlUnescape(text: string): string {
	return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity, body: string) => {
		if (body.startsWith('#')) {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: Number(body.slice(1));
			return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
		}
		// Unknown names stay verbatim rather than being silently dropped.
		return Object.hasOwn(NAMED_ENTITIES, body) ? (NAMED_ENTITIES[body] ?? entity) : entity;
	});
}

export function hexEncode(text: string): string {
	return Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, '0')).join(
		'',
	);
}

export function hexDecode(text: string): string {
	// Tolerate the usual dump formats: "68 65", "0x68,0x65", "\x68\x65", "68:65".
	const clean = text.replace(/0x|\\x|[\s:,]/gi, '');
	const bad = /[^0-9a-fA-F]/.exec(clean);
	if (bad) throw new Error(`Invalid hex character '${bad[0]}'`);
	if (clean.length % 2 !== 0) throw new Error('Invalid hex: odd number of digits');
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	return utf8Decode(bytes, 'Decoded hex');
}

/** Escapes non-ASCII as \uXXXX (UTF-16 units, so astral chars become surrogate pairs like JS/JSON). */
export function unicodeEscape(text: string): string {
	let out = '';
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		out += code > 0x7e ? `\\u${code.toString(16).padStart(4, '0')}` : text.charAt(i);
	}
	return out;
}

export function unicodeUnescape(text: string): string {
	return text.replace(
		/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})|\\x([0-9a-fA-F]{2})/g,
		(_m, braced?: string, u4?: string, u8?: string, x2?: string) => {
			if (u4 !== undefined) return String.fromCharCode(parseInt(u4, 16));
			if (x2 !== undefined) return String.fromCharCode(parseInt(x2, 16));
			const code = parseInt(braced ?? u8 ?? '', 16);
			if (code > 0x10ffff)
				throw new Error(`Code point 0x${code.toString(16)} is out of range`);
			return String.fromCodePoint(code);
		},
	);
}
