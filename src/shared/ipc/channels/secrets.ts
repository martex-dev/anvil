import { z } from 'zod';

import { defineChannels } from '../define';

const SecretKeySchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/, 'Invalid secret key');

/** Deliberately no `secrets:get`: values never leave main. */
export const secretChannels = defineChannels({
	'secrets:has': { input: SecretKeySchema, output: z.boolean() },
	'secrets:listSaved': { input: z.void(), output: z.array(z.string()) },
	'secrets:set': {
		input: z.object({ key: SecretKeySchema, value: z.string().min(1).max(16_384) }),
		output: z.void(),
	},
	'secrets:delete': { input: SecretKeySchema, output: z.void() },
});

export const secretEvents = {
	/** A secret was saved or removed (never carries the value). */
	'secrets:changed': z.object({ key: SecretKeySchema, saved: z.boolean() }),
};
