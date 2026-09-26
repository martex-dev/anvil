import {
	AbstractMessageReader,
	AbstractMessageWriter,
	type DataCallback,
	type Disposable,
	type Message,
	type MessageReader,
	type MessageWriter,
} from 'vscode-jsonrpc';

import { call } from '../../lib/ipc';

/**
 * JSON-RPC transport between the language client (renderer) and a language server (child
 * process of main). Each message rides the typed IPC contract; nothing here touches Node.
 */
class IpcReader extends AbstractMessageReader implements MessageReader {
	private readonly offExit: () => void;

	constructor(private readonly session: string) {
		super();
		this.offExit = window.anvil.on('lsp:exit', (e) => {
			if (e.session === this.session) this.fireClose();
		});
	}

	listen(callback: DataCallback): Disposable {
		const off = window.anvil.on('lsp:message', (e) => {
			if (e.session === this.session) callback(e.message as Message);
		});
		return { dispose: off };
	}

	override dispose(): void {
		this.offExit();
		super.dispose();
	}
}

class IpcWriter extends AbstractMessageWriter implements MessageWriter {
	private errors = 0;

	constructor(private readonly session: string) {
		super();
	}

	async write(message: Message): Promise<void> {
		try {
			await call('lsp:send', {
				session: this.session,
				message: message as unknown as Record<string, unknown>,
			});
		} catch (error) {
			this.errors += 1;
			this.fireError([
				error instanceof Error ? error : new Error(String(error)),
				message,
				this.errors,
			]);
		}
	}

	end(): void {
		// Nothing to flush: every write is its own IPC call.
	}
}

export function ipcTransports(session: string): { reader: MessageReader; writer: MessageWriter } {
	return { reader: new IpcReader(session), writer: new IpcWriter(session) };
}
