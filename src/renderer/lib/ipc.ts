import type { InvokeArgs } from '@shared/ipc/api';
import type { Channel, ChannelOutput } from '@shared/ipc/contract';
import type { IpcError } from '@shared/ipc/result';

/** Thrown by `call()` so TanStack Query and error boundaries can treat IPC failures as errors. */
export class IpcCallError extends Error {
	constructor(
		readonly channel: string,
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = 'IpcCallError';
	}

	static from(channel: string, error: IpcError): IpcCallError {
		return new IpcCallError(channel, error.code, error.message);
	}
}

/** Unwraps a Result: resolves with data or rejects with IpcCallError. */
export async function call<C extends Channel>(
	channel: C,
	...args: InvokeArgs<C>
): Promise<ChannelOutput<C>> {
	const result = await window.anvil.invoke(channel, ...args);
	if (!result.ok) throw IpcCallError.from(channel, result.error);
	return result.data;
}
