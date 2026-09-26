export interface SseEvent {
	event: string | null;
	data: string;
}

/**
 * Incremental Server-Sent Events parser (the streaming format of the Anthropic, OpenAI and
 * Gemini APIs). Feed decoded text in any chunking; complete events come out.
 */
export class SseParser {
	private buffer = '';

	push(text: string): SseEvent[] {
		this.buffer += text;
		const events: SseEvent[] = [];
		// Events end with a blank line; normalise CRLF so one rule covers every server.
		const normalized = this.buffer.replace(/\r\n/g, '\n');
		const blocks = normalized.split('\n\n');
		this.buffer = blocks.pop() ?? '';
		for (const block of blocks) {
			let event: string | null = null;
			const data: string[] = [];
			for (const line of block.split('\n')) {
				if (!line || line.startsWith(':')) continue; // comment / keep-alive
				const colon = line.indexOf(':');
				const field = colon === -1 ? line : line.slice(0, colon);
				const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
				if (field === 'event') event = value;
				else if (field === 'data') data.push(value);
			}
			if (data.length > 0) events.push({ event, data: data.join('\n') });
		}
		return events;
	}
}
