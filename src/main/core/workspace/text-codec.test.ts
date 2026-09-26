import { describe, expect, it } from 'vitest';

import { decodeText, encodeText } from './text-codec';

describe('text codec', () => {
	it('decodes valid UTF-8 and reports a BOM', () => {
		expect(decodeText(Buffer.from('﻿café', 'utf8'))).toEqual({
			text: 'café',
			encoding: 'utf8',
			bom: true,
		});
		expect(decodeText(Buffer.from('plain', 'utf8'))).toEqual({
			text: 'plain',
			encoding: 'utf8',
			bom: false,
		});
	});

	it('falls back to Windows-1252 for invalid UTF-8 and round-trips every byte', () => {
		// "café €5 “q”" as Excel writes it on a Western-European Windows.
		const bytes = Buffer.from([
			0x63, 0x61, 0x66, 0xe9, 0x20, 0x80, 0x35, 0x20, 0x93, 0x71, 0x94,
		]);
		const decoded = decodeText(bytes);
		expect(decoded).toEqual({ text: 'café €5 “q”', encoding: 'windows-1252', bom: false });
		expect(encodeText(decoded.text, 'windows-1252', false, 'a.csv')).toEqual(bytes);

		const all = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
		const text = decodeText(all).text;
		expect(encodeText(text, 'windows-1252', false, 'all.bin')).toEqual(all);
	});

	it('refuses to save characters Windows-1252 cannot store', () => {
		expect(() => encodeText('price ₿', 'windows-1252', false, 'a.csv')).toThrow(
			expect.objectContaining({ code: 'FS_ENCODING' }),
		);
	});

	it('writes UTF-8 with an optional BOM', () => {
		expect(encodeText('é', 'utf8', true, 'a.txt')).toEqual(Buffer.from('﻿é', 'utf8'));
		expect(encodeText('é', 'utf8', false, 'a.txt')).toEqual(Buffer.from('é', 'utf8'));
	});
});
