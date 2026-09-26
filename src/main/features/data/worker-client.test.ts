import { Worker } from 'node:worker_threads';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnvilError } from '../../core/errors';
import { DataWorkerClient, unpackedPath } from './worker-client';

// Tiny stand-in workers (plain JS via eval) that speak the same protocol as worker.ts.
const ECHO = `
const { parentPort } = require('node:worker_threads');
parentPort.on('message', (req) => {
	if (req.op === 'evict' && req.abs === 'anvil') {
		parentPort.postMessage({ id: req.id, ok: false, code: 'FS_NOT_FOUND', message: 'gone' });
	} else if (req.op === 'evict' && req.abs === 'bug') {
		parentPort.postMessage({ id: req.id, ok: false, code: null, message: 'boom' });
	} else if (req.op === 'evict' && req.abs === 'crash') {
		process.exit(3);
	} else {
		parentPort.postMessage({ id: req.id, ok: true, value: req.op });
	}
});
`;

let client: DataWorkerClient | null = null;
afterEach(async () => {
	await client?.dispose();
	client = null;
});

function make(): { client: DataWorkerClient; spawned: () => number } {
	let count = 0;
	const c = new DataWorkerClient(
		() => {
			count++;
			return new Worker(ECHO, { eval: true });
		},
		{ error: vi.fn() },
	);
	client = c;
	return { client: c, spawned: () => count };
}

describe('DataWorkerClient', () => {
	it('round-trips requests and rebuilds AnvilErrors', async () => {
		const { client } = make();
		await expect(client.call({ op: 'clear' })).resolves.toBe('clear');
		const failure = client.call({ op: 'evict', abs: 'anvil' });
		await expect(failure).rejects.toBeInstanceOf(AnvilError);
		await expect(failure).rejects.toMatchObject({ code: 'FS_NOT_FOUND', message: 'gone' });
		const bug = await client.call({ op: 'evict', abs: 'bug' }).catch((e: unknown) => e);
		expect(bug).toBeInstanceOf(Error);
		expect(bug).not.toBeInstanceOf(AnvilError);
	});

	it('fails pending calls when the worker dies and restarts it on the next call', async () => {
		const { client, spawned } = make();
		await expect(client.call({ op: 'evict', abs: 'crash' })).rejects.toMatchObject({
			code: 'DATA_WORKER_FAILED',
		});
		await expect(client.call({ op: 'clear' })).resolves.toBe('clear');
		expect(spawned()).toBe(2);
	});

	it('does not start a worker just to notify it', () => {
		const { client, spawned } = make();
		client.notify({ op: 'clear' });
		expect(spawned()).toBe(0);
	});
});

describe('unpackedPath', () => {
	it('points into app.asar.unpacked in a packaged app, and is a no-op in dev', () => {
		expect(unpackedPath('C:\\Program Files\\Anvil\\resources\\app.asar\\out\\main\\w.js')).toBe(
			'C:\\Program Files\\Anvil\\resources\\app.asar.unpacked\\out\\main\\w.js',
		);
		expect(unpackedPath('/repo/out/main/w.js')).toBe('/repo/out/main/w.js');
	});
});
