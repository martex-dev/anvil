import type { z } from 'zod';

export interface ChannelDef<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
	input: I;
	output: O;
}

/** Identity helper that keeps literal channel keys and schema types. */
export function defineChannels<T extends Record<string, ChannelDef>>(channels: T): T {
	return channels;
}

export function defineEvents<T extends Record<string, z.ZodType>>(events: T): T {
	return events;
}
