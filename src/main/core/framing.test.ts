import { describe, expect, it } from 'vitest';

import { encodeMessage, MessageDecoder } from './framing';

describe('Content-Length framing', () => {
	it('round-trips messages split at arbitrary byte boundaries', () => {
		const a = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { text: 'café ✓' } };
		const b = { jsonrpc: '2.0', method: 'initialized', params: {} };
		const bytes = Buffer.concat([encodeMessage(a), encodeMessage(b)]);
		for (const size of [1, 3, 7, bytes.length]) {
			const decoder = new MessageDecoder();
			const out: unknown[] = [];
			for (let i = 0; i < bytes.length; i += size) {
				out.push(...decoder.push(bytes.subarray(i, i + size)));
			}
			expect(out).toEqual([a, b]);
		}
	});

	it('counts Content-Length in bytes, not characters', () => {
		const encoded = encodeMessage({ s: 'ü' }).toString('utf8');
		expect(encoded.startsWith('Content-Length: 10\r\n\r\n')).toBe(true);
	});

	it('accepts extra headers and rejects missing lengths', () => {
		const body = '{"id":2}';
		const withType = `Content-Type: application/vscode-jsonrpc; charset=utf-8\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
		expect(new MessageDecoder().push(Buffer.from(withType))).toEqual([{ id: 2 }]);
		expect(() => new MessageDecoder().push(Buffer.from('X-Nope: 1\r\n\r\n{}'))).toThrow(
			/Content-Length/,
		);
	});

	it('decodes DAP messages (no jsonrpc field) that share a chunk with a partial one', () => {
		const event = { seq: 3, type: 'event', event: 'stopped', body: { threadId: 1 } };
		const request = { seq: 4, type: 'request', command: 'runInTerminal', arguments: {} };
		const bytes = Buffer.concat([encodeMessage(event), encodeMessage(request)]);
		const decoder = new MessageDecoder();
		const cut = encodeMessage(event).length + 5;
		expect(decoder.push(bytes.subarray(0, cut))).toEqual([event]);
		expect(decoder.push(bytes.subarray(cut))).toEqual([request]);
	});
});
