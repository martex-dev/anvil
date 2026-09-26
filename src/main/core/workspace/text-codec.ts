import type { TextEncoding } from '@shared/ipc/channels/fs';

import { AnvilError } from '../errors';

export interface DecodedText {
	text: string;
	encoding: TextEncoding;
	/** Started with a UTF-8 BOM (stripped from text). */
	bom: boolean;
}

/**
 * Windows-1252 bytes 0x80-0x9F that differ from Latin-1 (euro sign, smart quotes, dashes...).
 * The five undefined bytes (0x81, 0x8D, 0x8F, 0x90, 0x9D) map to themselves, as in the WHATWG
 * decoder, so every byte sequence decodes and encodes back unchanged.
 */
const CP1252_HIGH: Record<number, number> = {
	0x80: 0x20ac,
	0x82: 0x201a,
	0x83: 0x0192,
	0x84: 0x201e,
	0x85: 0x2026,
	0x86: 0x2020,
	0x87: 0x2021,
	0x88: 0x02c6,
	0x89: 0x2030,
	0x8a: 0x0160,
	0x8b: 0x2039,
	0x8c: 0x0152,
	0x8e: 0x017d,
	0x91: 0x2018,
	0x92: 0x2019,
	0x93: 0x201c,
	0x94: 0x201d,
	0x95: 0x2022,
	0x96: 0x2013,
	0x97: 0x2014,
	0x98: 0x02dc,
	0x99: 0x2122,
	0x9a: 0x0161,
	0x9b: 0x203a,
	0x9c: 0x0153,
	0x9e: 0x017e,
	0x9f: 0x0178,
};
const CP1252_REVERSE = new Map<number, number>(
	Object.entries(CP1252_HIGH).map(([byte, code]) => [code, Number(byte)]),
);

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function decodeCp1252(buf: Buffer): string {
	let out = '';
	for (const byte of buf) out += String.fromCharCode(CP1252_HIGH[byte] ?? byte);
	return out;
}

function encodeCp1252(text: string, name: string): Buffer {
	const out = Buffer.alloc(text.length);
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		// Bytes below 0x80, 0xA0-0xFF and the five undefined 0x80-0x9F bytes are identity.
		const identity = code <= 0xff && CP1252_HIGH[code] === undefined;
		const byte = identity ? code : CP1252_REVERSE.get(code);
		if (byte === undefined) {
			throw new AnvilError(
				'FS_ENCODING',
				`${name} is a Windows-1252 file and cannot store "${String.fromCodePoint(
					text.codePointAt(i) ?? code,
				)}". Remove it or convert the file to UTF-8.`,
			);
		}
		out[i] = byte;
	}
	return out;
}

/**
 * Decodes file bytes as UTF-8 when they are valid UTF-8, otherwise as Windows-1252 (what Excel
 * and older Windows tools write). Decoding invalid UTF-8 leniently would turn every accented
 * byte into U+FFFD and a save would destroy the original bytes.
 */
export function decodeText(buf: Buffer): DecodedText {
	try {
		const raw = utf8.decode(buf);
		const bom = raw.charCodeAt(0) === 0xfeff;
		return { text: bom ? raw.slice(1) : raw, encoding: 'utf8', bom };
	} catch {
		// Not valid UTF-8: a legacy single-byte file, which Windows-1252 always decodes.
		return { text: decodeCp1252(buf), encoding: 'windows-1252', bom: false };
	}
}

/** Encodes editor text back to the file's encoding. `name` is only used in error messages. */
export function encodeText(
	text: string,
	encoding: TextEncoding,
	bom: boolean,
	name: string,
): Buffer {
	if (encoding === 'windows-1252') return encodeCp1252(text, name);
	return Buffer.from(bom ? `\ufeff${text}` : text, 'utf8');
}
