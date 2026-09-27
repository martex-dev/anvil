import { describe, expect, it, vi } from 'vitest';

import { DapClient, DapRequestError } from './dap-client';
import type { DapMessage } from './dap-types';

function setup(): {
	client: DapClient;
	sent: DapMessage[];
	events: Array<[string, Record<string, unknown>]>;
} {
	const sent: DapMessage[] = [];
	const events: Array<[string, Record<string, unknown>]> = [];
	const client = new DapClient(
		(m) => {
			sent.push(m);
			return Promise.resolve();
		},
		(event, body) => events.push([event, body]),
	);
	return { client, sent, events };
}

describe('DAP client', () => {
	it('numbers requests and resolves each with its own response body', async () => {
		const { client, sent } = setup();
		const a = client.request('threads');
		const b = client.request('scopes', { frameId: 2 });
		expect(sent).toEqual([
			{ seq: 1, type: 'request', command: 'threads' },
			{ seq: 2, type: 'request', command: 'scopes', arguments: { frameId: 2 } },
		]);
		client.receive({ type: 'response', request_seq: 2, success: true, body: { scopes: [] } });
		client.receive({ type: 'response', request_seq: 1, success: true, body: { threads: [1] } });
		await expect(a).resolves.toEqual({ threads: [1] });
		await expect(b).resolves.toEqual({ scopes: [] });
	});

	it('rejects failed requests with the adapter’s message', async () => {
		const { client } = setup();
		const r = client.request('evaluate', { expression: 'nope' });
		client.receive({
			type: 'response',
			request_seq: 1,
			success: false,
			message: "NameError: name 'nope' is not defined",
		});
		await expect(r).rejects.toBeInstanceOf(DapRequestError);
		await expect(r).rejects.toThrow(/NameError/);
	});

	it('hands events to the listener and ignores stray responses', () => {
		const { client, events } = setup();
		client.receive({ type: 'response', request_seq: 42, success: true });
		client.receive({ type: 'event', event: 'stopped', body: { threadId: 1 } });
		client.receive({ type: 'event', event: 'initialized' });
		expect(events).toEqual([
			['stopped', { threadId: 1 }],
			['initialized', {}],
		]);
	});

	it('answers reverse requests and fails pending ones when closed', async () => {
		const { client, sent } = setup();
		const pending = client.request('stackTrace', { threadId: 1 });
		await client.respond(7, 'runInTerminal');
		expect(sent.at(-1)).toMatchObject({
			type: 'response',
			request_seq: 7,
			command: 'runInTerminal',
			success: true,
		});
		client.close();
		await expect(pending).rejects.toThrow(/ended/);
		await expect(client.request('threads')).rejects.toThrow(/ended/);
	});

	it('rejects a request whose send failed (the session is gone in main)', async () => {
		const onEvent = vi.fn();
		const client = new DapClient(() => Promise.reject(new Error('not running')), onEvent);
		await expect(client.request('threads')).rejects.toThrow('not running');
	});
});
