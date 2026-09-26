import type { z } from 'zod';

import {
	type Channel,
	type ChannelOutput,
	type ChannelParsedInput,
	type IpcContract,
	isChannel,
} from '@shared/ipc/contract';
import { err, ok, type Result } from '@shared/ipc/result';

import { AnvilError } from './errors';

export type Handler<C extends Channel> = (
	input: ChannelParsedInput<C>,
) => Promise<ChannelOutput<C>> | ChannelOutput<C>;

type AnyHandler = (input: unknown) => unknown;

export interface RouterLogger {
	error(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	debug?(message: string, meta?: Record<string, unknown>): void;
}

// Normal outcomes that panels handle (sidecar still starting, a search replaced by a newer one):
// logging them as warnings every poll buries real problems.
const EXPECTED_ERRORS = new Set(['SIDECAR_UNAVAILABLE', 'SEARCH_CANCELLED']);

/**
 * Validates every incoming call against the shared contract before any handler runs,
 * and turns every outcome (including thrown errors) into a Result.
 */
export class IpcRouter {
	private readonly handlers = new Map<Channel, AnyHandler>();

	constructor(
		private readonly contract: IpcContract,
		private readonly logger: RouterLogger,
	) {}

	/** Registers a handler; returns a function that unregisters it (used when a module is disabled). */
	handle<C extends Channel>(channel: C, handler: Handler<C>): () => void {
		if (this.handlers.has(channel)) {
			throw new Error(`IPC handler already registered for "${channel}"`);
		}
		this.handlers.set(channel, handler as AnyHandler);
		return () => {
			if (this.handlers.get(channel) === (handler as AnyHandler))
				this.handlers.delete(channel);
		};
	}

	has(channel: Channel): boolean {
		return this.handlers.has(channel);
	}

	async dispatch(channel: string, rawInput: unknown): Promise<Result<unknown>> {
		if (!isChannel(channel)) {
			this.logger.warn('[ipc] unknown channel', { channel });
			return err('UNKNOWN_CHANNEL', `Unknown channel "${channel}"`);
		}
		const handler = this.handlers.get(channel);
		if (!handler) {
			return err('NO_HANDLER', `"${channel}" is not available (module disabled?)`);
		}

		const def = this.contract[channel];
		const parsed = (def.input as z.ZodType).safeParse(rawInput);
		if (!parsed.success) {
			const message = parsed.error.issues
				.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
				.join('; ');
			this.logger.warn('[ipc] invalid input', { channel, message });
			return err('INVALID_INPUT', message);
		}

		try {
			const output = await handler(parsed.data);
			const checked = (def.output as z.ZodType).safeParse(output);
			if (!checked.success) {
				this.logger.error('[ipc] handler returned invalid output', {
					channel,
					issues: checked.error.issues.map((i) => i.message),
				});
				return err('INVALID_OUTPUT', `"${channel}" returned an unexpected shape`);
			}
			return ok(checked.data);
		} catch (error) {
			if (error instanceof AnvilError) {
				const meta = { channel, code: error.code, message: error.message };
				if (EXPECTED_ERRORS.has(error.code))
					this.logger.debug?.('[ipc] handler error', meta);
				else this.logger.warn('[ipc] handler error', meta);
				return err(error.code, error.message);
			}
			this.logger.error('[ipc] handler crashed', {
				channel,
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
			return err(
				'HANDLER_ERROR',
				error instanceof Error ? error.message : 'Unexpected error',
			);
		}
	}
}
