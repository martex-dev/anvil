import {
	base64Decode,
	base64Encode,
	hexDecode,
	hexEncode,
	htmlEscape,
	htmlUnescape,
	jsonEscape,
	jsonUnescape,
	unicodeEscape,
	unicodeUnescape,
	urlDecode,
} from './codecs';
import { mapBody } from './text-lines';
import { type Transform } from './types';

// Codecs see the whole selection minus its final newline, which mapBody restores afterwards.
function whole(fn: (body: string) => string): (text: string) => string {
	return (text) => mapBody(text, (body) => fn(body));
}

export const ENCODE_TRANSFORMS: readonly Transform[] = [
	{
		id: 'base64-encode',
		label: 'Base64 encode',
		group: 'Encode',
		example: 'aGVsbG8=',
		run: whole(base64Encode),
	},
	{
		id: 'url-encode',
		label: 'URL encode',
		group: 'Encode',
		example: 'a%20b%26c',
		run: whole(encodeURIComponent),
	},
	{
		id: 'json-escape',
		label: 'JSON string escape',
		group: 'Encode',
		example: 'say \\"hi\\"\\n',
		run: whole(jsonEscape),
	},
	{
		id: 'html-escape',
		label: 'HTML entities escape',
		group: 'Encode',
		example: '&lt;div&gt;',
		run: whole(htmlEscape),
	},
	{
		id: 'hex-encode',
		label: 'Hex encode',
		group: 'Encode',
		example: '68656c6c6f',
		run: whole(hexEncode),
	},
	{
		id: 'unicode-escape',
		label: 'Unicode escape',
		group: 'Encode',
		example: 'caf\\u00e9',
		run: whole(unicodeEscape),
	},
	{
		id: 'base64-decode',
		label: 'Base64 decode',
		group: 'Decode',
		example: 'hello',
		run: whole(base64Decode),
	},
	{
		id: 'url-decode',
		label: 'URL decode',
		group: 'Decode',
		example: 'a b&c',
		run: whole(urlDecode),
	},
	{
		id: 'json-unescape',
		label: 'JSON string unescape',
		group: 'Decode',
		example: 'say "hi"',
		run: whole(jsonUnescape),
	},
	{
		id: 'html-unescape',
		label: 'HTML entities unescape',
		group: 'Decode',
		example: '<div>',
		run: whole(htmlUnescape),
	},
	{
		id: 'hex-decode',
		label: 'Hex decode',
		group: 'Decode',
		example: 'hello',
		run: whole(hexDecode),
	},
	{
		id: 'unicode-unescape',
		label: 'Unicode unescape',
		group: 'Decode',
		example: 'café',
		run: whole(unicodeUnescape),
	},
];
