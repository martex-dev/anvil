import { bodyOf, type DapMessage, num, str } from './dap-types';

/** A request the adapter answered with `success: false` (e.g. a NameError in an evaluate). */
export class DapRequestError extends Error {
	constructor(
		readonly command: string,
		message: string,
	) {
		super(message);
		this.name = 'DapRequestError';
	}
}

interface Pending {
	command: string;
	resolve: (body: Record<string, unknown>) => void;
	reject: (error: Error) => void;
}

/**
 * The renderer's end of one DAP conversation: numbers requests, matches responses to them and
 * hands everything else (events) to `onEvent`. The transport is injected (debug:send in the app,
 * an array in tests), and `receive` is fed whatever main relays from the adapter.
 */
export class DapClient {
	private seq = 1;
	private readonly pending = new Map<number, Pending>();
	private closed = false;

	constructor(
		private readonly transport: (message: DapMessage) => Promise<void>,
		private readonly onEvent: (event: string, body: Record<string, unknown>) => void,
	) {}

	request(command: string, args?: Record<string, unknown>): Promise<Record<string, unknown>> {
		if (this.closed) return Promise.reject(new Error('The debug session has ended'));
		const seq = this.seq++;
		return new Promise((resolve, reject) => {
			this.pending.set(seq, { command, resolve, reject });
			const message: DapMessage = { seq, type: 'request', command };
			if (args) message['arguments'] = args;
			this.transport(message).catch((error: unknown) => {
				this.pending.delete(seq);
				reject(error instanceof Error ? error : new Error(String(error)));
			});
		});
	}

	/** Answers a reverse request from the adapter (runInTerminal). */
	respond(requestSeq: number, command: string, error?: string): Promise<void> {
		const message: DapMessage = {
			seq: this.seq++,
			type: 'response',
			request_seq: requestSeq,
			command,
			success: error === undefined,
			...(error === undefined ? { body: {} } : { message: error }),
		};
		return this.transport(message);
	}

	receive(message: DapMessage): void {
		if (message['type'] === 'response') {
			const seq = num(message['request_seq']);
			const waiting = seq === undefined ? undefined : this.pending.get(seq);
			if (!waiting || seq === undefined) return;
			this.pending.delete(seq);
			if (message['success'] === true) waiting.resolve(bodyOf(message));
			else
				waiting.reject(
					new DapRequestError(
						waiting.command,
						str(message['message']) ?? `${waiting.command} failed`,
					),
				);
			return;
		}
		if (message['type'] === 'event') {
			const event = str(message['event']);
			if (event) this.onEvent(event, bodyOf(message));
		}
	}

	/** Fails every request still waiting: the adapter is gone and will never answer. */
	close(): void {
		this.closed = true;
		for (const p of this.pending.values()) p.reject(new Error('The debug session has ended'));
		this.pending.clear();
	}
}
