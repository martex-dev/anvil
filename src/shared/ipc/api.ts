import type { AnvilEvent, Channel, ChannelInput, ChannelOutput, EventPayload } from './contract';
import type { Result } from './result';

/** Internal transport channel names; renderer code never uses these directly. */
export const TRANSPORT = {
	invoke: 'anvil:invoke',
	event: 'anvil:event',
} as const;

export interface InvokeEnvelope {
	channel: string;
	input: unknown;
}

export interface EventEnvelope {
	event: string;
	payload: unknown;
}

/** Channels whose input accepts undefined (z.void / optional) can be invoked with no argument. */
export type InvokeArgs<C extends Channel> =
	undefined extends ChannelInput<C> ? [input?: ChannelInput<C>] : [input: ChannelInput<C>];

/** Shape of `window.anvil`, exposed by the preload script. */
export interface AnvilApi {
	invoke<C extends Channel>(
		channel: C,
		...args: InvokeArgs<C>
	): Promise<Result<ChannelOutput<C>>>;
	on<E extends AnvilEvent>(event: E, handler: (payload: EventPayload<E>) => void): () => void;
	platform: string;
}
