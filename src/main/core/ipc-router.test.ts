import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { IpcContract } from '@shared/ipc/contract';

import { AnvilError } from './errors';
import { IpcRouter } from './ipc-router';

vi.mock('@shared/ipc/contract', async () => {
	const { z } = await import('zod');
	const contract = {
		'test:echo': {
			input: z.object({ n: z.number().int() }),
			output: z.object({ n: z.number() }),
		},
		'test:void': { input: z.void(), output: z.string() },
	};
	return {
		ipcContract: contract,
		isChannel: (name: string) => Object.prototype.hasOwnProperty.call(contract, name),
	};
});

const contract = {
	'test:echo': { input: z.object({ n: z.number().int() }), output: z.object({ n: z.number() }) },
	'test:void': { input: z.void(), output: z.string() },
} as unknown as IpcContract;

function makeRouter(): {
	router: IpcRouter;
	logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
} {
	const logger = { error: vi.fn(), warn: vi.fn() };
	return { router: new IpcRouter(contract, logger), logger };
}

// Channel names in these tests aren't in the real contract; cast through never.
const ch = (name: string): never => name as never;

describe('IpcRouter', () => {
	it('returns ok with handler output for valid input', async () => {
		const { router } = makeRouter();
		router.handle(ch('test:echo'), ((input: { n: number }) => ({ n: input.n * 2 })) as never);
		await expect(router.dispatch('test:echo', { n: 21 })).resolves.toEqual({
			ok: true,
			data: { n: 42 },
		});
	});

	it('supports void input', async () => {
		const { router } = makeRouter();
		router.handle(ch('test:void'), (() => 'pong') as never);
		await expect(router.dispatch('test:void', undefined)).resolves.toEqual({
			ok: true,
			data: 'pong',
		});
	});

	it('rejects invalid input without calling the handler', async () => {
		const { router } = makeRouter();
		const handler = vi.fn(() => ({ n: 1 }));
		router.handle(ch('test:echo'), handler as never);
		const result = await router.dispatch('test:echo', { n: 'not a number' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
		expect(handler).not.toHaveBeenCalled();
	});

	it('rejects non-integer input without calling the handler', async () => {
		const { router } = makeRouter();
		const handler = vi.fn();
		router.handle(ch('test:echo'), handler as never);
		const result = await router.dispatch('test:echo', { n: 1.5 });
		expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
		expect(handler).not.toHaveBeenCalled();
	});

	it('turns a thrown Error into HANDLER_ERROR and logs it', async () => {
		const { router, logger } = makeRouter();
		router.handle(ch('test:echo'), (() => {
			throw new Error('boom');
		}) as never);
		await expect(router.dispatch('test:echo', { n: 1 })).resolves.toEqual({
			ok: false,
			error: { code: 'HANDLER_ERROR', message: 'boom' },
		});
		expect(logger.error).toHaveBeenCalled();
	});

	it('preserves AnvilError codes', async () => {
		const { router } = makeRouter();
		router.handle(ch('test:echo'), (async () => {
			throw new AnvilError('SIDECAR_DOWN', 'Sidecar is not running');
		}) as never);
		await expect(router.dispatch('test:echo', { n: 1 })).resolves.toMatchObject({
			ok: false,
			error: { code: 'SIDECAR_DOWN' },
		});
	});

	it('rejects handler output that violates the schema', async () => {
		const { router } = makeRouter();
		router.handle(ch('test:echo'), (() => ({ wrong: true })) as never);
		await expect(router.dispatch('test:echo', { n: 1 })).resolves.toMatchObject({
			ok: false,
			error: { code: 'INVALID_OUTPUT' },
		});
	});

	it('reports unknown channels and missing handlers', async () => {
		const { router } = makeRouter();
		await expect(router.dispatch('nope:nope', {})).resolves.toMatchObject({
			error: { code: 'UNKNOWN_CHANNEL' },
		});
		await expect(router.dispatch('test:void', undefined)).resolves.toMatchObject({
			error: { code: 'NO_HANDLER' },
		});
	});

	it('unregisters handlers', async () => {
		const { router } = makeRouter();
		const off = router.handle(ch('test:void'), (() => 'x') as never);
		off();
		await expect(router.dispatch('test:void', undefined)).resolves.toMatchObject({
			error: { code: 'NO_HANDLER' },
		});
	});

	it('refuses duplicate registration', () => {
		const { router } = makeRouter();
		router.handle(ch('test:void'), (() => 'x') as never);
		expect(() => router.handle(ch('test:void'), (() => 'y') as never)).toThrow(
			/already registered/,
		);
	});
});
