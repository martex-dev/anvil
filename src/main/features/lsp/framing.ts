/**
 * LSP base protocol over stdio: `Content-Length: <bytes>\r\n\r\n<utf-8 JSON>`. Messages can
 * arrive split across chunks or several per chunk.
 */

const SEPARATOR = Buffer.from('\r\n\r\n');
// A language server sending more than this in one message is broken or hostile.
const MAX_MESSAGE_BYTES = 64 * 1024 * 1024;

export function encodeMessage(message: unknown): Buffer {
	const body = Buffer.from(JSON.stringify(message), 'utf8');
	return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body]);
}

export class MessageDecoder {
	private buffer: Buffer = Buffer.alloc(0);
	private expected: number | null = null;

	/** Feeds raw stdout; returns every complete message now available. */
	push(chunk: Buffer): unknown[] {
		this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
		const out: unknown[] = [];
		for (;;) {
			if (this.expected === null) {
				const end = this.buffer.indexOf(SEPARATOR);
				if (end === -1) break;
				const header = this.buffer.subarray(0, end).toString('ascii');
				this.buffer = this.buffer.subarray(end + SEPARATOR.length);
				const length = /Content-Length:\s*(\d+)/i.exec(header)?.[1];
				if (length === undefined)
					throw new Error(`LSP header without Content-Length: ${header}`);
				this.expected = Number(length);
				if (this.expected > MAX_MESSAGE_BYTES)
					throw new Error(`LSP message too large: ${length} bytes`);
			}
			if (this.buffer.length < this.expected) break;
			const body = this.buffer.subarray(0, this.expected).toString('utf8');
			this.buffer = this.buffer.subarray(this.expected);
			this.expected = null;
			out.push(JSON.parse(body));
		}
		return out;
	}
}
