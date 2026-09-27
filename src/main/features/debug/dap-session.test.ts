import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { encodeMessage, MessageDecoder } from '../../core/framing';
import { DapSession, type DapSessionEvents } from './dap-session';

/** A stand-in adapter process: we write its stdout, and read what the session sends it. */
function fakeAdapter(): {
	child: ChildProcessWithoutNullStreams;
	sent: () => Array<Record<string, unknown>>;
	emitMessage: (m: unknown) => void;
	exit: (code: number) => void;
	stdinEnded: () => boolean;
} {
	const child = new EventEmitter() as ChildProcessWithoutNullStreams;
	const stdin = new PassThrough();
	const stdout = new PassThrough();
	Object.assign(child, { stdin, stdout, stderr: new PassThrough(), pid: 4242 });
	const decoder = new MessageDecoder();
	const received: Array<Record<string, unknown>> = [];
	stdin.on('data', (chunk: Buffer) => {
		for (const m of decoder.push(chunk)) received.push(m as Record<string, unknown>);
	});
	return {
		child,
		sent: () => received,
		emitMessage: (m) => stdout.write(encodeMessage(m)),
		exit: (code) => child.emit('exit', code),
		stdinEnded: () => stdin.writableEnded,
	};
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

function start(): {
	session: DapSession;
	adapter: ReturnType<typeof fakeAdapter>;
	events: { [K in keyof DapSessionEvents]: ReturnType<typeof vi.fn> };
} {
	const adapter = fakeAdapter();
	const events = { message: vi.fn(), runInTerminal: vi.fn(), exit: vi.fn() };
	const session = new DapSession(
		'id',
		{ python: 'python', env: {}, cwd: '.' },
		{ request: 'launch', program: 'C:\\p\\main.py', python: 'C:\\py\\python.exe' },
		events,
		() => adapter.child,
	);
	return { session, adapter, events };
}

describe('DAP session relay', () => {
	it('replaces the arguments of a launch request with main’s configuration', async () => {
		const { session, adapter } = start();
		session.send({
			seq: 2,
			type: 'request',
			command: 'launch',
			arguments: { python: 'C:\\evil.exe', program: 'x' },
		});
		session.send({ seq: 3, type: 'request', command: 'threads' });
		await tick();
		expect(adapter.sent()).toEqual([
			{
				seq: 2,
				type: 'request',
				command: 'launch',
				arguments: {
					request: 'launch',
					program: 'C:\\p\\main.py',
					python: 'C:\\py\\python.exe',
				},
			},
			{ seq: 3, type: 'request', command: 'threads' },
		]);
		expect(() => session.send({ seq: 4, type: 'request', command: 'attach' })).toThrow();
	});

	it('relays events and turns runInTerminal into its own callback', async () => {
		const { adapter, events } = start();
		adapter.emitMessage({ seq: 1, type: 'event', event: 'initialized' });
		adapter.emitMessage({
			seq: 2,
			type: 'request',
			command: 'runInTerminal',
			arguments: {
				kind: 'integrated',
				title: 'Python Debug',
				args: ['py', 'x'],
				cwd: 'C:\\p',
			},
		});
		await tick();
		expect(events.message).toHaveBeenCalledWith({
			seq: 1,
			type: 'event',
			event: 'initialized',
		});
		expect(events.message).toHaveBeenCalledTimes(1);
		expect(events.runInTerminal).toHaveBeenCalledWith(
			2,
			{ args: ['py', 'x'], env: {}, cwd: 'C:\\p' },
			'Python Debug',
		);
	});

	it('answers a malformed runInTerminal itself', async () => {
		const { adapter, events } = start();
		adapter.emitMessage({ seq: 7, type: 'request', command: 'runInTerminal', arguments: {} });
		await tick();
		expect(events.runInTerminal).not.toHaveBeenCalled();
		expect(adapter.sent()[0]).toMatchObject({
			type: 'response',
			request_seq: 7,
			success: false,
		});
	});

	it('reports the exit once and stops writing afterwards', async () => {
		const { session, adapter, events } = start();
		adapter.exit(1);
		adapter.exit(1);
		session.send({ seq: 9, type: 'request', command: 'threads' });
		await session.dispose();
		await tick();
		expect(events.exit).toHaveBeenCalledTimes(1);
		expect(events.exit).toHaveBeenCalledWith(1, '');
		expect(adapter.sent()).toEqual([]);
	});

	it('says goodbye with disconnect on dispose and resolves once the adapter exits', async () => {
		const { session, adapter } = start();
		const done = session.dispose();
		await tick();
		expect(adapter.sent()[0]).toMatchObject({
			type: 'request',
			command: 'disconnect',
			arguments: { terminateDebuggee: true },
		});
		adapter.exit(0);
		await expect(done).resolves.toBeUndefined();
	});

	it('closes the adapter’s stdin once it has answered disconnect, so it can exit', async () => {
		const { session, adapter, events } = start();
		session.send({ seq: 5, type: 'request', command: 'disconnect', arguments: {} });
		adapter.emitMessage({ seq: 9, type: 'response', request_seq: 5, command: 'threads' });
		await tick();
		expect(adapter.stdinEnded()).toBe(false);
		adapter.emitMessage({
			seq: 10,
			type: 'response',
			request_seq: 5,
			command: 'disconnect',
			success: true,
		});
		await tick();
		expect(adapter.stdinEnded()).toBe(true);
		expect(events.message).toHaveBeenLastCalledWith(
			expect.objectContaining({ command: 'disconnect' }),
		);
	});
});
