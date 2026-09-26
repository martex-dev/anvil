export type EncodingKind = 'base64' | 'base64url' | 'hex' | 'base58' | 'url';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function utf8Encode(text: string): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(text);
}

/** Strict decode: binary data that isn't text should fail loudly rather than show mojibake. */
export function utf8Decode(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new Error('Decoded bytes are not valid UTF-8 text (try the hex view instead)');
	}
}

export function bytesToHex(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) out += b.toString(16).padStart(2, '0');
	return out;
}

export function hexToBytes(hex: string): Uint8Array {
	const clean = hex.replace(/\s+/g, '').replace(/^0x/i, '');
	if (clean.length % 2 !== 0) throw new Error('Hex input must have an even number of digits');
	if (!/^[0-9a-f]*$/i.test(clean)) throw new Error('Hex input contains non-hex characters');
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	// Chunked so large inputs don't overflow the argument limit of String.fromCharCode.
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

export function base64ToBytes(input: string): Uint8Array {
	const clean = input.replace(/\s+/g, '');
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.replace(/=+$/, '').length % 4 === 1) {
		throw new Error('Invalid base64 input');
	}
	const unpadded = clean.replace(/=+$/, '');
	const padded = unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
	return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(input: string): Uint8Array {
	const clean = input.replace(/\s+/g, '');
	if (!/^[A-Za-z0-9_-]*={0,2}$/.test(clean)) throw new Error('Invalid base64url input');
	return base64ToBytes(clean.replace(/-/g, '+').replace(/_/g, '/'));
}

export function bytesToBase58(bytes: Uint8Array): string {
	let zeros = 0;
	while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
	let num = bytes.length > zeros ? BigInt('0x' + bytesToHex(bytes.subarray(zeros))) : 0n;
	let out = '';
	while (num > 0n) {
		out = BASE58_ALPHABET.charAt(Number(num % 58n)) + out;
		num /= 58n;
	}
	// Each leading zero byte is encoded as a leading '1' so the byte length round-trips.
	return '1'.repeat(zeros) + out;
}

export function base58ToBytes(input: string): Uint8Array {
	const clean = input.trim();
	let zeros = 0;
	while (zeros < clean.length && clean[zeros] === '1') zeros++;
	let num = 0n;
	for (const ch of clean.slice(zeros)) {
		const digit = BASE58_ALPHABET.indexOf(ch);
		if (digit === -1) throw new Error(`Invalid base58 character '${ch}'`);
		num = num * 58n + BigInt(digit);
	}
	let hex = num > 0n ? num.toString(16) : '';
	if (hex.length % 2) hex = '0' + hex;
	const rest = hexToBytes(hex);
	const bytes = new Uint8Array(zeros + rest.length);
	bytes.set(rest, zeros);
	return bytes;
}

/** Base58 (Bitcoin/Solana alphabet) to lowercase hex, e.g. a Solana address to its 32 bytes. */
export function base58ToHex(s: string): string {
	return bytesToHex(base58ToBytes(s));
}

export function hexToBase58(s: string): string {
	return bytesToBase58(hexToBytes(s));
}

/** Re-encodes raw bytes and reports how many there are, counted from the decoded bytes. */
export function convertBytes(input: string, to: 'hex' | 'base58'): { text: string; bytes: number } {
	const bytes = to === 'hex' ? base58ToBytes(input) : hexToBytes(input);
	return { text: to === 'hex' ? bytesToHex(bytes) : bytesToBase58(bytes), bytes: bytes.length };
}

export function encode(kind: EncodingKind, text: string): string {
	switch (kind) {
		case 'base64':
			return bytesToBase64(utf8Encode(text));
		case 'base64url':
			return bytesToBase64Url(utf8Encode(text));
		case 'hex':
			return bytesToHex(utf8Encode(text));
		case 'base58':
			return bytesToBase58(utf8Encode(text));
		case 'url':
			return encodeURIComponent(text);
	}
}

/** Decodes to UTF-8 text. For 'url', '+' is read as a space, as in form-encoded query strings. */
export function decode(kind: EncodingKind, text: string): string {
	switch (kind) {
		case 'base64':
			return utf8Decode(base64ToBytes(text));
		case 'base64url':
			return utf8Decode(base64UrlToBytes(text));
		case 'hex':
			return utf8Decode(hexToBytes(text));
		case 'base58':
			return utf8Decode(base58ToBytes(text));
		case 'url':
			try {
				return decodeURIComponent(text.replace(/\+/g, ' '));
			} catch {
				throw new Error('Invalid percent-encoding in URL input');
			}
	}
}
